import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from './user.entity';
import { Post } from '../posts/post.entity';
import { Reply } from '../replies/reply.entity';
import { BarMember } from '../bars/bar-member.entity';
import { Bar } from '../bars/bar.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Reply)
    private readonly repliesRepository: Repository<Reply>,
    @InjectRepository(BarMember)
    private readonly barMembersRepository: Repository<BarMember>,
    @InjectRepository(Bar)
    private readonly barsRepository: Repository<Bar>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    nickname: string;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: data.email,
      passwordHash: data.passwordHash,
      nickname: data.nickname,
    });
    return this.usersRepository.save(user);
  }

  async findMyPosts(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoin('post.bar', 'bar')
      .addSelect(['bar.id', 'bar.name'])
      .where('post.author_id = :userId', { userId })
      .orderBy('post.created_at', 'DESC')
      .take(take + 1);

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('post.created_at < :ca', { ca: decodedDate });
      } catch {
        // invalid cursor
      }
    }

    const posts = await qb.getMany();
    const hasMore = posts.length > take;
    const items = hasMore ? posts.slice(0, take) : posts;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            items[items.length - 1].createdAt.toISOString(),
          ).toString('base64')
        : null;

    const data = items.map((p) => ({
      id: p.id,
      title: p.title,
      barId: p.barId,
      barName: p.bar?.name ?? null,
      replyCount: p.replyCount,
      createdAt: p.createdAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  async findMyReplies(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const qb = this.repliesRepository
      .createQueryBuilder('reply')
      .leftJoin('reply.post', 'post')
      .addSelect(['post.id', 'post.title', 'post.barId'])
      .leftJoin('post.bar', 'bar')
      .addSelect(['bar.name'])
      .where('reply.author_id = :userId', { userId })
      .orderBy('reply.created_at', 'DESC')
      .take(take + 1);

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('reply.created_at < :ca', { ca: decodedDate });
      } catch {
        // invalid cursor
      }
    }

    const replies = await qb.getMany();
    const hasMore = replies.length > take;
    const items = hasMore ? replies.slice(0, take) : replies;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            items[items.length - 1].createdAt.toISOString(),
          ).toString('base64')
        : null;

    const data = items.map((r) => ({
      id: r.id,
      content: r.content.length > 100 ? r.content.slice(0, 100) + '...' : r.content,
      postId: r.post?.id ?? r.postId,
      postTitle: r.post?.title ?? null,
      barName: r.post?.bar?.name ?? null,
      floorNumber: r.floorNumber,
      createdAt: r.createdAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  async findMyBars(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    // Auto-unsuspend expired bars in user's joined list
    const memberBarIds = await this.barMembersRepository.find({
      where: { userId },
      select: ['barId'],
    });
    if (memberBarIds.length > 0) {
      await this.barsRepository
        .createQueryBuilder()
        .update(Bar)
        .set({ status: 'active', suspendUntil: null, statusReason: null })
        .where("status = 'suspended' AND suspend_until <= NOW()")
        .andWhere('id IN (:...ids)', {
          ids: memberBarIds.map((m) => m.barId),
        })
        .execute();
    }

    const qb = this.barMembersRepository
      .createQueryBuilder('bm')
      .leftJoinAndSelect('bm.bar', 'bar')
      .where('bm.user_id = :userId', { userId })
      .orderBy('bm.joined_at', 'DESC')
      .take(take + 1);

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('bm.joined_at < :ja', { ja: decodedDate });
      } catch {
        // invalid cursor
      }
    }

    const memberships = await qb.getMany();
    const hasMore = memberships.length > take;
    const items = hasMore ? memberships.slice(0, take) : memberships;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            items[items.length - 1].joinedAt.toISOString(),
          ).toString('base64')
        : null;

    const data = items.map((m) => ({
      id: m.bar.id,
      name: m.bar.name,
      description: m.bar.description,
      status: m.bar.status,
      statusReason: m.bar.statusReason,
      suspendUntil: m.bar.suspendUntil,
      memberCount: m.bar.memberCount,
      joinedAt: m.joinedAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  async findMyCreatedBars(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    // Auto-unsuspend expired bars created by this user
    await this.barsRepository
      .createQueryBuilder()
      .update(Bar)
      .set({ status: 'active', suspendUntil: null, statusReason: null })
      .where("status = 'suspended' AND suspend_until <= NOW()")
      .andWhere('created_by = :userId', { userId })
      .execute();

    const qb = this.barsRepository
      .createQueryBuilder('bar')
      .where('bar.created_by = :userId', { userId })
      .orderBy('bar.created_at', 'DESC')
      .take(take + 1);

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('bar.created_at < :ca', { ca: decodedDate });
      } catch {
        // invalid cursor
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

    const data = items.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      statusReason: b.statusReason,
      suspendUntil: b.suspendUntil,
      createdAt: b.createdAt,
    }));

    return { data, meta: { cursor: nextCursor, hasMore }, error: null };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);

    if (dto.nickname !== undefined) user.nickname = dto.nickname;
    if (dto.bio !== undefined) user.bio = dto.bio;

    const updated = await this.usersRepository.save(user);
    this.logger.log(`Profile updated: userId=${userId}`);

    const { passwordHash, ...rest } = updated as any;
    void passwordHash;
    return rest;
  }
}
