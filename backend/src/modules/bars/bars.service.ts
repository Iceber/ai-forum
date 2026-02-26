import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bar } from './bar.entity';
import { BarMember } from './bar-member.entity';
import { CreateBarDto } from './dto/create-bar.dto';

@Injectable()
export class BarsService {
  private readonly logger = new Logger(BarsService.name);

  constructor(
    @InjectRepository(Bar)
    private readonly barsRepository: Repository<Bar>,
    @InjectRepository(BarMember)
    private readonly barMembersRepository: Repository<BarMember>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lazy Evaluation: auto-unsuspend expired bars (§3.7).
   * Encapsulated as independent method for explicit calls and future migration.
   */
  async autoUnsuspendIfExpired(barId: string): Promise<Bar | null> {
    const bar = await this.barsRepository.findOne({ where: { id: barId } });
    if (!bar) return null;
    if (
      bar.status === 'suspended' &&
      bar.suspendUntil &&
      bar.suspendUntil <= new Date()
    ) {
      bar.status = 'active';
      bar.suspendUntil = null;
      bar.statusReason = null;
      await this.barsRepository.save(bar);
      this.logger.log(`Bar auto-unsuspended: barId=${barId}`);
    }
    return bar;
  }

  /**
   * GET /api/bars — only active bars, sorted by memberCount DESC then createdAt DESC.
   * Runs lazy eval on suspended bars before filtering.
   */
  async findAll(cursor?: string, limit = 20, userId?: string) {
    const take = Math.min(limit, 100);

    // Auto-unsuspend expired bars before listing
    await this.barsRepository
      .createQueryBuilder()
      .update(Bar)
      .set({ status: 'active', suspendUntil: null, statusReason: null })
      .where("status = 'suspended' AND suspend_until <= NOW()")
      .execute();

    const qb = this.barsRepository
      .createQueryBuilder('bar')
      .where("bar.status = 'active'")
      .orderBy('bar.member_count', 'DESC')
      .addOrderBy('bar.created_at', 'DESC')
      .take(take + 1);

    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere(
          '(bar.member_count < :mc OR (bar.member_count = :mc AND bar.created_at < :ca))',
          { mc: decoded.memberCount, ca: new Date(decoded.createdAt) },
        );
      } catch {
        // invalid cursor, ignore
      }
    }

    const bars = await qb.getMany();
    const hasMore = bars.length > take;
    const items = hasMore ? bars.slice(0, take) : bars;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          memberCount: last.memberCount,
          createdAt: last.createdAt.toISOString(),
        }),
      ).toString('base64');
    }

    // Attach isMember for logged-in users
    let memberBarIds: Set<string> | null = null;
    if (userId) {
      const memberships = await this.barMembersRepository.find({
        where: { userId },
        select: ['barId'],
      });
      memberBarIds = new Set(memberships.map((m) => m.barId));
    }

    const data = items.map((bar) => ({
      id: bar.id,
      name: bar.name,
      description: bar.description,
      avatarUrl: bar.avatarUrl,
      category: bar.category,
      status: bar.status,
      memberCount: bar.memberCount,
      isMember: memberBarIds ? memberBarIds.has(bar.id) : null,
      createdAt: bar.createdAt,
      updatedAt: bar.updatedAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  /**
   * GET /api/bars/:id — bar detail with Phase 2 fields.
   * pending_review/rejected only visible to creator.
   */
  async findOne(id: string, userId?: string): Promise<Record<string, unknown>> {
    let bar = await this.autoUnsuspendIfExpired(id);
    if (!bar) throw new NotFoundException('Bar not found');

    // pending_review/rejected only visible to creator
    if (
      (bar.status === 'pending_review' || bar.status === 'rejected') &&
      bar.createdById !== userId
    ) {
      throw new NotFoundException('Bar not found');
    }

    // Load creator info
    const barWithCreator = await this.barsRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    let isMember: boolean | null = null;
    let memberRole: string | null = null;
    if (userId) {
      const membership = await this.barMembersRepository.findOne({
        where: { barId: id, userId },
      });
      isMember = !!membership;
      memberRole = membership?.role ?? null;
    }

    return {
      id: barWithCreator!.id,
      name: barWithCreator!.name,
      description: barWithCreator!.description,
      avatarUrl: barWithCreator!.avatarUrl,
      rules: barWithCreator!.rules,
      category: barWithCreator!.category,
      status: barWithCreator!.status,
      statusReason: barWithCreator!.statusReason,
      suspendUntil: barWithCreator!.suspendUntil,
      memberCount: barWithCreator!.memberCount,
      isMember,
      memberRole,
      createdBy: barWithCreator!.createdBy
        ? {
            id: barWithCreator!.createdBy.id,
            nickname: barWithCreator!.createdBy.nickname,
          }
        : null,
      createdAt: barWithCreator!.createdAt,
      updatedAt: barWithCreator!.updatedAt,
    };
  }

  /**
   * POST /api/bars — submit bar creation application.
   * Sets status=pending_review, creates owner membership, memberCount=1.
   */
  async create(dto: CreateBarDto, userId: string): Promise<Bar> {
    const existing = await this.barsRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Bar name already exists',
        error: 'BAR_NAME_DUPLICATE',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const bar = manager.create(Bar, {
        name: dto.name,
        description: dto.description,
        category: dto.category ?? null,
        rules: dto.rules ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        status: 'pending_review',
        createdById: userId,
        memberCount: 1,
      });
      const savedBar = await manager.save(bar);

      const member = manager.create(BarMember, {
        barId: savedBar.id,
        userId,
        role: 'owner',
      });
      await manager.save(member);

      this.logger.log(
        `Bar creation submitted: barId=${savedBar.id}, creatorId=${userId}`,
      );
      return savedBar;
    });
  }

  /**
   * POST /api/bars/:id/join — join a bar.
   * Bar must be active or suspended. User must not already be a member.
   */
  async join(barId: string, userId: string) {
    const bar = await this.autoUnsuspendIfExpired(barId);
    if (!bar) throw new NotFoundException('Bar not found');

    // pending_review/rejected not visible
    if (bar.status === 'pending_review' || bar.status === 'rejected') {
      throw new NotFoundException('Bar not found');
    }

    if (bar.status !== 'active' && bar.status !== 'suspended') {
      throw new ConflictException({
        message: 'Bar status does not allow joining',
        error: 'BAR_NOT_JOINABLE',
      });
    }

    const existing = await this.barMembersRepository.findOne({
      where: { barId, userId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Already a member of this bar',
        error: 'BAR_NOT_JOINABLE',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const member = manager.create(BarMember, {
        barId,
        userId,
        role: 'member',
      });
      const saved = await manager.save(member);

      await manager.increment(Bar, { id: barId }, 'memberCount', 1);

      this.logger.log(`User joined bar: userId=${userId}, barId=${barId}`);
      return saved;
    });
  }

  /**
   * POST /api/bars/:id/leave — leave a bar.
   * Owner cannot leave. Bar must be active or suspended.
   */
  async leave(barId: string, userId: string) {
    const bar = await this.autoUnsuspendIfExpired(barId);
    if (!bar) throw new NotFoundException('Bar not found');

    if (bar.status === 'pending_review' || bar.status === 'rejected') {
      throw new NotFoundException('Bar not found');
    }

    if (bar.status !== 'active' && bar.status !== 'suspended') {
      throw new ConflictException({
        message: 'Bar status does not allow leaving',
        error: 'BAR_NOT_LEAVABLE',
      });
    }

    const membership = await this.barMembersRepository.findOne({
      where: { barId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Not a member of this bar');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenException(
        'Bar owner cannot leave. Please transfer ownership first.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.remove(membership);
      await manager.decrement(Bar, { id: barId }, 'memberCount', 1);

      this.logger.log(`User left bar: userId=${userId}, barId=${barId}`);
      return { success: true };
    });
  }

  /**
   * Used internally (e.g. seeding) to create a bar with owner membership.
   * Legacy method from Phase 1 - now sets member_count = 1.
   */
  async createWithOwner(
    data: {
      name: string;
      description: string;
      avatarUrl?: string;
      rules?: string;
      category?: string;
    },
    userId: string,
  ): Promise<Bar> {
    return this.dataSource.transaction(async (manager) => {
      const bar = manager.create(Bar, {
        ...data,
        createdById: userId,
        status: 'active',
        memberCount: 1,
      });
      const savedBar = await manager.save(bar);

      const member = manager.create(BarMember, {
        barId: savedBar.id,
        userId,
        role: 'owner',
      });
      await manager.save(member);

      return savedBar;
    });
  }
}
