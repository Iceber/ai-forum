import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bar } from './bar.entity';
import { BarMember } from './bar-member.entity';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';

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
    if (userId && items.length > 0) {
      const barIds = items.map((b) => b.id);
      const memberships = await this.barMembersRepository
        .createQueryBuilder('bm')
        .select('bm.bar_id', 'barId')
        .where('bm.user_id = :userId', { userId })
        .andWhere('bm.bar_id IN (:...barIds)', { barIds })
        .getRawMany();
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

    // Reload with creator relation
    const barWithCreator = await this.barsRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!barWithCreator) throw new NotFoundException('Bar not found');

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
      id: barWithCreator.id,
      name: barWithCreator.name,
      description: barWithCreator.description,
      avatarUrl: barWithCreator.avatarUrl,
      rules: barWithCreator.rules,
      category: barWithCreator.category,
      status: barWithCreator.status,
      statusReason: barWithCreator.statusReason,
      suspendUntil: barWithCreator.suspendUntil,
      memberCount: barWithCreator.memberCount,
      isMember,
      memberRole,
      createdBy: barWithCreator.createdBy
        ? {
            id: barWithCreator.createdBy.id,
            nickname: barWithCreator.createdBy.nickname,
          }
        : null,
      createdAt: barWithCreator.createdAt,
      updatedAt: barWithCreator.updatedAt,
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
        error: 'ALREADY_MEMBER',
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

  private async checkBarManageable(barId: string): Promise<Bar> {
    const bar = await this.barsRepository.findOne({ where: { id: barId } });
    if (!bar) throw new NotFoundException('Bar not found');
    if (bar.status !== 'active' && bar.status !== 'suspended') {
      throw new ForbiddenException({
        message: 'Bar is not manageable in its current status',
        error: 'BAR_NOT_MANAGEABLE',
      });
    }
    return bar;
  }

  async updateBar(barId: string, dto: UpdateBarDto, userId: string) {
    const bar = await this.checkBarManageable(barId);

    const membership = await this.barMembersRepository.findOne({
      where: { barId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
      throw new ForbiddenException('No permission to edit this bar');
    }

    // Moderators cannot change category
    if (membership.role === 'moderator' && dto.category !== undefined) {
      throw new ForbiddenException('Moderators cannot change bar category');
    }

    if (dto.description !== undefined) bar.description = dto.description;
    if (dto.rules !== undefined) bar.rules = dto.rules;
    if (dto.avatarUrl !== undefined) bar.avatarUrl = dto.avatarUrl;
    if (dto.category !== undefined) bar.category = dto.category;

    const saved = await this.barsRepository.save(bar);
    this.logger.log(`Bar updated: barId=${barId}, userId=${userId}`);
    return saved;
  }

  async getMembers(
    barId: string,
    userId: string,
    cursor?: string,
    limit = 20,
    role?: string,
  ) {
    await this.checkBarManageable(barId);

    const membership = await this.barMembersRepository.findOne({
      where: { barId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
      throw new ForbiddenException('No permission to view member list');
    }

    if (role && !['member', 'moderator', 'owner'].includes(role)) {
      throw new BadRequestException('Invalid role filter');
    }

    const take = Math.min(limit, 100);
    const qb = this.barMembersRepository
      .createQueryBuilder('bm')
      .leftJoinAndSelect('bm.user', 'user')
      .where('bm.barId = :barId', { barId })
      .orderBy('bm.joinedAt', 'DESC')
      .take(take + 1);

    if (role) {
      qb.andWhere('bm.role = :role', { role });
    }

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('bm.joinedAt < :ja', { ja: decodedDate });
      } catch {
        // invalid cursor
      }
    }

    const members = await qb.getMany();
    const hasMore = members.length > take;
    const items = hasMore ? members.slice(0, take) : members;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            items[items.length - 1].joinedAt.toISOString(),
          ).toString('base64')
        : null;

    const data = items.map((m) => ({
      id: m.id,
      userId: m.userId,
      nickname: m.user?.nickname ?? null,
      avatarUrl: m.user?.avatarUrl ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  async changeRole(
    barId: string,
    targetUserId: string,
    role: 'member' | 'moderator',
    userId: string,
  ) {
    await this.checkBarManageable(barId);

    const callerMembership = await this.barMembersRepository.findOne({
      where: { barId, userId },
    });
    if (!callerMembership || callerMembership.role !== 'owner') {
      throw new ForbiddenException('Only bar owner can change member roles');
    }

    const targetMembership = await this.barMembersRepository.findOne({
      where: { barId, userId: targetUserId },
    });
    if (!targetMembership) {
      throw new NotFoundException('Target user is not a member of this bar');
    }

    if (targetMembership.role === 'owner') {
      throw new ConflictException({
        message: 'Cannot change owner role. Use transfer endpoint instead.',
        error: 'ROLE_CHANGE_INVALID',
      });
    }

    targetMembership.role = role;
    const saved = await this.barMembersRepository.save(targetMembership);
    this.logger.log(
      `Member role changed: barId=${barId}, targetUserId=${targetUserId}, newRole=${role}, byUserId=${userId}`,
    );
    return saved;
  }

  async transferOwnership(barId: string, targetUserId: string, userId: string) {
    await this.checkBarManageable(barId);

    const ownerMembership = await this.barMembersRepository.findOne({
      where: { barId, userId },
    });
    if (!ownerMembership || ownerMembership.role !== 'owner') {
      throw new ForbiddenException('Only bar owner can transfer ownership');
    }

    const targetMembership = await this.barMembersRepository.findOne({
      where: { barId, userId: targetUserId },
      relations: ['user'],
    });
    if (!targetMembership) {
      throw new NotFoundException('Target user is not a member of this bar');
    }

    if (targetMembership.role === 'owner') {
      throw new ConflictException({
        message: 'Target is already the owner',
        error: 'ALREADY_OWNER',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      // Demote current owner to moderator
      ownerMembership.role = 'moderator';
      await manager.save(ownerMembership);

      // Promote target to owner
      targetMembership.role = 'owner';
      await manager.save(targetMembership);

      this.logger.log(
        `Bar ownership transferred: barId=${barId}, from=${userId}, to=${targetUserId}`,
      );

      return {
        id: targetMembership.userId,
        nickname: targetMembership.user?.nickname ?? null,
        role: 'owner',
      };
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
