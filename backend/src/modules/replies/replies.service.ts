import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reply } from './reply.entity';
import { Post } from '../posts/post.entity';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { UserLike } from '../likes/user-like.entity';
import { CreateReplyDto } from './dto/create-reply.dto';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class RepliesService {
  private readonly logger = new Logger(RepliesService.name);

  constructor(
    @InjectRepository(Reply)
    private readonly repliesRepository: Repository<Reply>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Bar)
    private readonly barsRepository: Repository<Bar>,
    @InjectRepository(BarMember)
    private readonly barMembersRepository: Repository<BarMember>,
    @InjectRepository(UserLike)
    private readonly likesRepository: Repository<UserLike>,
    private readonly postsService: PostsService,
    private readonly dataSource: DataSource,
  ) {}

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

  async findByPost(postId: string, cursor?: string, limit = 20, userId?: string) {
    const take = Math.min(limit, 100);

    // Only return main replies (parent_reply_id IS NULL), excluding deleted/hidden
    const qb = this.repliesRepository
      .createQueryBuilder('reply')
      .leftJoinAndSelect('reply.author', 'author')
      .where('reply.postId = :postId', { postId })
      .andWhere('reply.parentReplyId IS NULL')
      .andWhere('reply.status = :status', { status: 'published' })
      .andWhere('reply.deletedAt IS NULL')
      .orderBy('reply.floorNumber', 'ASC')
      .take(take + 1);

    if (cursor) {
      try {
        const afterFloor = parseInt(
          Buffer.from(cursor, 'base64').toString('utf8'),
          10,
        );
        if (afterFloor > 0) {
          qb.andWhere('reply.floorNumber > :af', { af: afterFloor });
        }
      } catch {
        // invalid cursor
      }
    }

    const replies = await qb.getMany();
    const hasMore = replies.length > take;
    const items = hasMore ? replies.slice(0, take) : replies;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(String(items[items.length - 1].floorNumber)).toString(
            'base64',
          )
        : null;

    // Get the post to determine author for isAuthor flag
    const post = await this.postsRepository.findOne({ where: { id: postId } });

    const replyIds = items.map((r) => r.id);

    // Batch fetch likes for all replies
    const likedIdSet = new Set<string>();
    if (userId && replyIds.length > 0) {
      const likes = await this.likesRepository
        .createQueryBuilder('like')
        .where('like.userId = :userId', { userId })
        .andWhere('like.targetType = :type', { type: 'reply' })
        .andWhere('like.targetId IN (:...ids)', { ids: replyIds })
        .getMany();
      for (const like of likes) likedIdSet.add(like.targetId);
    }

    // Batch fetch earliest 3 child replies per parent using a lateral-join-like approach
    const childPreviewMap = new Map<string, Reply[]>();
    const childLikedIdSet = new Set<string>();
    if (replyIds.length > 0) {
      const allChildren = await this.repliesRepository
        .createQueryBuilder('reply')
        .leftJoinAndSelect('reply.author', 'author')
        .where('reply.parentReplyId IN (:...ids)', { ids: replyIds })
        .andWhere('reply.status = :status', { status: 'published' })
        .andWhere('reply.deletedAt IS NULL')
        .orderBy('reply.createdAt', 'ASC')
        .getMany();

      for (const child of allChildren) {
        const parentId = child.parentReplyId!;
        const list = childPreviewMap.get(parentId) ?? [];
        if (list.length < 3) {
          list.push(child);
          childPreviewMap.set(parentId, list);
        }
      }

      if (userId && allChildren.length > 0) {
        const childIds = allChildren.map((child) => child.id);
        const childLikes = await this.likesRepository
          .createQueryBuilder('like')
          .where('like.userId = :userId', { userId })
          .andWhere('like.targetType = :type', { type: 'reply' })
          .andWhere('like.targetId IN (:...ids)', { ids: childIds })
          .getMany();
        for (const like of childLikes) childLikedIdSet.add(like.targetId);
      }
    }

    const data = items.map((reply) => ({
      id: reply.id,
      postId: reply.postId,
      authorId: reply.authorId,
      author: reply.author,
      floorNumber: reply.floorNumber,
      content: reply.content,
      contentType: reply.contentType,
      likeCount: reply.likeCount,
      childCount: reply.childCount,
      status: reply.status,
      isLiked: userId ? likedIdSet.has(reply.id) : null,
      isAuthor: post ? reply.authorId === post.authorId : false,
      parentReplyId: reply.parentReplyId,
        childPreview: (childPreviewMap.get(reply.id) ?? []).map((c) => ({
          id: c.id,
          content: c.content,
          contentType: c.contentType,
          author: c.author,
          createdAt: c.createdAt,
          likeCount: c.likeCount,
          isLiked: userId ? childLikedIdSet.has(c.id) : null,
        })),
      createdAt: reply.createdAt,
    }));

    return {
      data,
      meta: { cursor: nextCursor, hasMore },
      error: null,
    };
  }

  async findChildren(replyId: string, cursor?: string, limit = 10, userId?: string) {
    const take = Math.min(limit, 50);

    const parent = await this.repliesRepository.findOne({ where: { id: replyId } });
    if (!parent || parent.deletedAt) {
      throw new NotFoundException('Reply not found');
    }

    const qb = this.repliesRepository
      .createQueryBuilder('reply')
      .leftJoinAndSelect('reply.author', 'author')
      .where('reply.parentReplyId = :replyId', { replyId })
      .andWhere('reply.status = :status', { status: 'published' })
      .andWhere('reply.deletedAt IS NULL')
      .orderBy('reply.createdAt', 'ASC')
      .take(take + 1);

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('reply.createdAt > :ca', { ca: decodedDate });
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

    // Get the post to determine author for isAuthor flag
    const post = await this.postsRepository.findOne({
      where: { id: parent.postId },
    });

    // Batch fetch likes for all child replies
    const childIds = items.map((r) => r.id);
    const likedIdSet = new Set<string>();
    if (userId && childIds.length > 0) {
      const likes = await this.likesRepository
        .createQueryBuilder('like')
        .where('like.userId = :userId', { userId })
        .andWhere('like.targetType = :type', { type: 'reply' })
        .andWhere('like.targetId IN (:...ids)', { ids: childIds })
        .getMany();
      for (const like of likes) likedIdSet.add(like.targetId);
    }

    const data = items.map((reply) => ({
      id: reply.id,
      content: reply.content,
      contentType: reply.contentType,
      author: reply.author
        ? { id: reply.author.id, nickname: reply.author.nickname }
        : null,
      createdAt: reply.createdAt,
      likeCount: reply.likeCount,
      isLiked: userId ? likedIdSet.has(reply.id) : null,
      isAuthor: post ? reply.authorId === post.authorId : false,
      parentReplyId: reply.parentReplyId,
      floorNumber: reply.floorNumber,
    }));

    return {
      data,
      meta: { cursor: nextCursor, hasMore },
      error: null,
    };
  }

  async create(
    postId: string,
    dto: CreateReplyDto,
    authorId: string,
  ): Promise<Reply> {
    // Verify post exists and is accessible
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt || post.status !== 'published') {
      throw new NotFoundException('Post not found');
    }

    const isChildReply = !!dto.parentReplyId;

    // If child reply, validate parent reply
    if (isChildReply) {
      const parentReply = await this.repliesRepository.findOne({
        where: { id: dto.parentReplyId },
      });
      if (!parentReply || parentReply.postId !== postId) {
        throw new NotFoundException('Parent reply not found');
      }
      if (parentReply.deletedAt || parentReply.status === 'hidden') {
        throw new NotFoundException('Parent reply not found');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      let floorNumber: number | null = null;

      if (!isChildReply) {
        // Calculate next floor number atomically for main replies only
        const result = await manager
          .createQueryBuilder(Reply, 'reply')
          .select('MAX(reply.floor_number)', 'maxFloor')
          .where('reply.post_id = :postId', { postId })
          .andWhere('reply.parent_reply_id IS NULL')
          .getRawOne<{ maxFloor: number | null }>();

        floorNumber = (result?.maxFloor ?? 0) + 1;
      }

      const reply = manager.create(Reply, {
        postId,
        authorId,
        parentReplyId: dto.parentReplyId ?? null,
        floorNumber,
        content: dto.content,
        contentType: dto.contentType ?? 'plaintext',
      });

      const saved = await manager.save(reply);

      if (!isChildReply) {
        // Only increment post reply_count for main replies
        await manager.increment(Post, { id: postId }, 'replyCount', 1);
        await manager.update(Post, postId, { lastReplyAt: saved.createdAt });
      } else {
        // Increment parent reply's child_count
        await manager.increment(
          Reply,
          { id: dto.parentReplyId },
          'childCount',
          1,
        );
      }

      const createdReply = await manager.findOne(Reply, {
        where: { id: saved.id },
        relations: ['author'],
      });

      if (!createdReply) {
        throw new InternalServerErrorException('Failed to load created reply');
      }

      this.logger.log(
        `Reply created: replyId=${saved.id}, postId=${postId}, parentReplyId=${dto.parentReplyId ?? 'null'}`,
      );

      return createdReply;
    });
  }

  async deleteReply(replyId: string, userId: string) {
    const reply = await this.repliesRepository.findOne({
      where: { id: replyId },
      relations: ['post'],
    });
    if (!reply || reply.deletedAt) throw new NotFoundException('Reply not found');

    const post = reply.post;
    if (!post) throw new NotFoundException('Post not found');

    await this.checkBarManageable(post.barId);

    // Permission: author, bar owner, bar moderator
    const isAuthor = reply.authorId === userId;
    let isBarStaff = false;
    if (!isAuthor) {
      const membership = await this.barMembersRepository.findOne({
        where: { barId: post.barId, userId },
      });
      isBarStaff =
        !!membership &&
        (membership.role === 'owner' || membership.role === 'moderator');
    }

    if (!isAuthor && !isBarStaff) {
      throw new ForbiddenException('No permission to delete this reply');
    }

    const now = new Date();
    const isMainReply = reply.parentReplyId === null;
    const isParentReply = reply.childCount > 0;

    return this.dataSource.transaction(async (manager) => {
      // Soft delete this reply
      await manager.update(Reply, replyId, {
        deletedAt: now,
        status: 'deleted',
      });

      if (isMainReply) {
        // Decrement post reply_count
        await manager.decrement(Post, { id: post.id }, 'replyCount', 1);
      }

      if (isParentReply || isMainReply) {
        // Cascade soft delete child replies
        await manager
          .createQueryBuilder()
          .update(Reply)
          .set({ deletedAt: now, status: 'deleted' })
          .where('parent_reply_id = :replyId AND deleted_at IS NULL', {
            replyId,
          })
          .execute();
      }

      if (!isMainReply && reply.parentReplyId) {
        // Decrement parent's child_count
        await manager.decrement(
          Reply,
          { id: reply.parentReplyId },
          'childCount',
          1,
        );
      }

      this.logger.log(`Reply deleted: replyId=${replyId}, userId=${userId}`);
    });
  }

  async hideReply(replyId: string, userId: string) {
    const reply = await this.repliesRepository.findOne({
      where: { id: replyId },
      relations: ['post'],
    });
    if (!reply || reply.deletedAt) throw new NotFoundException('Reply not found');

    const post = reply.post;
    if (!post) throw new NotFoundException('Post not found');

    await this.checkBarManageable(post.barId);

    const membership = await this.barMembersRepository.findOne({
      where: { barId: post.barId, userId },
    });
    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'moderator')
    ) {
      throw new ForbiddenException('No permission to hide this reply');
    }

    if (reply.status === 'hidden') {
      return reply;
    }

    reply.status = 'hidden';
    const saved = await this.repliesRepository.save(reply);
    this.logger.log(`Reply hidden: replyId=${replyId}, userId=${userId}`);
    return saved;
  }

  async unhideReply(replyId: string, userId: string) {
    const reply = await this.repliesRepository.findOne({
      where: { id: replyId },
      relations: ['post'],
    });
    if (!reply || reply.deletedAt) throw new NotFoundException('Reply not found');

    const post = reply.post;
    if (!post) throw new NotFoundException('Post not found');

    await this.checkBarManageable(post.barId);

    const membership = await this.barMembersRepository.findOne({
      where: { barId: post.barId, userId },
    });
    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'moderator')
    ) {
      throw new ForbiddenException('No permission to unhide this reply');
    }

    if (reply.status !== 'hidden') {
      return reply;
    }

    reply.status = 'published';
    const saved = await this.repliesRepository.save(reply);
    this.logger.log(`Reply unhidden: replyId=${replyId}, userId=${userId}`);
    return saved;
  }
}
