import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Bar } from '../bars/bar.entity';
import { AdminAction } from './admin-action.entity';
import { BarsService } from '../bars/bars.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Bar)
    private readonly barsRepository: Repository<Bar>,
    @InjectRepository(AdminAction)
    private readonly adminActionsRepository: Repository<AdminAction>,
    private readonly barsService: BarsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAllBars(status?: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    const qb = this.barsRepository
      .createQueryBuilder('bar')
      .leftJoinAndSelect('bar.createdBy', 'creator')
      .orderBy('bar.createdAt', 'DESC')
      .take(take + 1);

    if (status) {
      qb.where('bar.status = :status', { status });
    }

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('bar.createdAt < :ca', { ca: decodedDate });
      } catch {
        // invalid cursor, ignore
      }
    }

    const bars = await qb.getMany();
    const hasMore = bars.length > take;
    const items = hasMore ? bars.slice(0, take) : bars;

    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            items[items.length - 1].createdAt.toISOString(),
          ).toString('base64')
        : null;

    const data = items.map((bar) => ({
      id: bar.id,
      name: bar.name,
      status: bar.status,
      statusReason: bar.statusReason,
      suspendUntil: bar.suspendUntil,
      memberCount: bar.memberCount,
      createdBy: bar.createdBy
        ? { id: bar.createdBy.id, nickname: bar.createdBy.nickname }
        : null,
      createdAt: bar.createdAt,
      updatedAt: bar.updatedAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  async approveBar(barId: string, adminId: string) {
    const bar = await this.getBarWithLazyEval(barId);

    if (bar.status !== 'pending_review') {
      throw new ConflictException({
        message: `Cannot approve bar in '${bar.status}' status`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      bar.status = 'active';
      bar.statusReason = null;
      bar.reviewedById = adminId;
      bar.reviewedAt = new Date();
      await manager.save(bar);

      const action = manager.create(AdminAction, {
        adminId,
        action: 'approve',
        targetType: 'bar',
        targetId: barId,
      });
      await manager.save(action);

      this.logger.log(`Bar approved: barId=${barId}, adminId=${adminId}`);
      return { success: true };
    });
  }

  async rejectBar(barId: string, adminId: string, reason: string) {
    const bar = await this.getBarWithLazyEval(barId);

    if (bar.status !== 'pending_review') {
      throw new ConflictException({
        message: `Cannot reject bar in '${bar.status}' status`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      bar.status = 'rejected';
      bar.statusReason = reason;
      bar.reviewedById = adminId;
      bar.reviewedAt = new Date();
      await manager.save(bar);

      const action = manager.create(AdminAction, {
        adminId,
        action: 'reject',
        targetType: 'bar',
        targetId: barId,
        reason,
      });
      await manager.save(action);

      this.logger.log(
        `Bar rejected: barId=${barId}, adminId=${adminId}, reason=${reason}`,
      );
      return { success: true };
    });
  }

  async suspendBar(
    barId: string,
    adminId: string,
    reason: string,
    duration: number,
  ) {
    const bar = await this.getBarWithLazyEval(barId);

    if (bar.status !== 'active' && bar.status !== 'suspended') {
      throw new ConflictException({
        message: `Cannot suspend bar in '${bar.status}' status`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    const suspendUntil = new Date(Date.now() + duration * 60 * 60 * 1000);

    return this.dataSource.transaction(async (manager) => {
      bar.status = 'suspended';
      bar.statusReason = reason;
      bar.suspendUntil = suspendUntil;
      await manager.save(bar);

      const action = manager.create(AdminAction, {
        adminId,
        action: 'suspend',
        targetType: 'bar',
        targetId: barId,
        reason,
        metadata: { duration, suspendUntil: suspendUntil.toISOString() },
      });
      await manager.save(action);

      this.logger.log(
        `Bar suspended: barId=${barId}, adminId=${adminId}, duration=${duration}h`,
      );
      return { success: true };
    });
  }

  async unsuspendBar(barId: string, adminId: string) {
    const bar = await this.getBarWithLazyEval(barId);

    if (bar.status !== 'suspended') {
      throw new ConflictException({
        message: `Cannot unsuspend bar in '${bar.status}' status`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      bar.status = 'active';
      bar.statusReason = null;
      bar.suspendUntil = null;
      await manager.save(bar);

      const action = manager.create(AdminAction, {
        adminId,
        action: 'unsuspend',
        targetType: 'bar',
        targetId: barId,
      });
      await manager.save(action);

      this.logger.log(`Bar unsuspended: barId=${barId}, adminId=${adminId}`);
      return { success: true };
    });
  }

  async banBar(barId: string, adminId: string, reason: string) {
    const bar = await this.getBarWithLazyEval(barId);

    if (bar.status !== 'active' && bar.status !== 'suspended') {
      throw new ConflictException({
        message: `Cannot ban bar in '${bar.status}' status`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      bar.status = 'permanently_banned';
      bar.statusReason = reason;
      bar.suspendUntil = null;
      await manager.save(bar);

      const action = manager.create(AdminAction, {
        adminId,
        action: 'ban',
        targetType: 'bar',
        targetId: barId,
        reason,
      });
      await manager.save(action);

      this.logger.log(`Bar banned: barId=${barId}, adminId=${adminId}`);
      return { success: true };
    });
  }

  async closeBar(barId: string, adminId: string, reason: string) {
    const bar = await this.getBarWithLazyEval(barId);

    if (bar.status !== 'active' && bar.status !== 'suspended') {
      throw new ConflictException({
        message: `Cannot close bar in '${bar.status}' status`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      bar.status = 'closed';
      bar.statusReason = reason;
      bar.suspendUntil = null;
      await manager.save(bar);

      const action = manager.create(AdminAction, {
        adminId,
        action: 'close',
        targetType: 'bar',
        targetId: barId,
        reason,
      });
      await manager.save(action);

      this.logger.log(`Bar closed: barId=${barId}, adminId=${adminId}`);
      return { success: true };
    });
  }

  async findAllActions(cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    const qb = this.adminActionsRepository
      .createQueryBuilder('action')
      .leftJoinAndSelect('action.admin', 'admin')
      .orderBy('action.createdAt', 'DESC')
      .take(take + 1);

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.where('action.createdAt < :ca', { ca: decodedDate });
      } catch {
        // invalid cursor, ignore
      }
    }

    const actions = await qb.getMany();
    const hasMore = actions.length > take;
    const items = hasMore ? actions.slice(0, take) : actions;

    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            items[items.length - 1].createdAt.toISOString(),
          ).toString('base64')
        : null;

    // Batch load target bar names
    const barIds = [
      ...new Set(
        items
          .filter((a) => a.targetType === 'bar')
          .map((a) => a.targetId),
      ),
    ];
    const bars =
      barIds.length > 0
        ? await this.barsRepository.findByIds(barIds)
        : [];
    const barNameMap = new Map(bars.map((b) => [b.id, b.name]));

    const data = items.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      targetName: barNameMap.get(a.targetId) ?? null,
      adminId: a.adminId,
      adminNickname: a.admin?.nickname ?? null,
      reason: a.reason,
      createdAt: a.createdAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  private async getBarWithLazyEval(barId: string): Promise<Bar> {
    const bar = await this.barsService.autoUnsuspendIfExpired(barId);
    if (!bar) throw new NotFoundException('Bar not found');
    return bar;
  }
}
