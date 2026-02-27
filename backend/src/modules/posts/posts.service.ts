import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Post } from './post.entity';
import { Reply } from '../replies/reply.entity';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { UserLike } from '../likes/user-like.entity';
import { UserFavorite } from '../favorites/user-favorite.entity';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Reply)
    private readonly repliesRepository: Repository<Reply>,
    @InjectRepository(Bar)
    private readonly barsRepository: Repository<Bar>,
    @InjectRepository(BarMember)
    private readonly barMembersRepository: Repository<BarMember>,
    @InjectRepository(UserLike)
    private readonly likesRepository: Repository<UserLike>,
    @InjectRepository(UserFavorite)
    private readonly favoritesRepository: Repository<UserFavorite>,
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

  async findAll(barId?: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.bar', 'bar')
      .where('post.status = :status', { status: 'published' })
      .andWhere('post.deletedAt IS NULL')
      .orderBy('post.createdAt', 'DESC')
      .take(take + 1);

    if (barId) {
      qb.andWhere('post.barId = :barId', { barId });
    }

    if (cursor) {
      try {
        const decodedDate = new Date(
          Buffer.from(cursor, 'base64').toString('utf8'),
        );
        qb.andWhere('post.createdAt < :ca', { ca: decodedDate });
      } catch {
        // invalid cursor — ignore and return unfiltered results
      }
    }

    const posts = await qb.getMany();
    const hasMore = posts.length > take;
    const items = hasMore ? posts.slice(0, take) : posts;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(items[items.length - 1].createdAt.toISOString()).toString(
            'base64',
          )
        : null;

    return {
      data: items,
      meta: { cursor: nextCursor, hasMore },
      error: null,
    };
  }

  async findOne(id: string, userId?: string): Promise<Record<string, unknown>> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'bar'],
    });
    if (!post) throw new NotFoundException('Post not found');

    // Visibility: deleted posts only visible to author
    if (post.deletedAt || post.status === 'deleted') {
      if (!userId || post.authorId !== userId) {
        throw new NotFoundException('Post not found');
      }
    }

    // Hidden posts only visible to author, bar moderators/owners
    if (post.status === 'hidden' && userId) {
      const membership = await this.barMembersRepository.findOne({
        where: { barId: post.barId, userId },
      });
      if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
        if (post.authorId !== userId) {
          throw new NotFoundException('Post not found');
        }
      }
    } else if (post.status === 'hidden' && !userId) {
      throw new NotFoundException('Post not found');
    }

    let isLiked: boolean | null = null;
    let isFavorited: boolean | null = null;
    if (userId) {
      const like = await this.likesRepository.findOne({
        where: { userId, targetType: 'post', targetId: id },
      });
      isLiked = !!like;

      const fav = await this.favoritesRepository.findOne({
        where: { userId, postId: id },
      });
      isFavorited = !!fav;
    }

    return {
      id: post.id,
      barId: post.barId,
      bar: post.bar,
      authorId: post.authorId,
      author: post.author,
      title: post.status === 'deleted' ? '帖子已删除' : post.title,
      content: post.status === 'deleted' ? '' : post.content,
      contentType: post.contentType,
      replyCount: post.replyCount,
      likeCount: post.likeCount,
      favoriteCount: post.favoriteCount,
      shareCount: post.shareCount,
      lastReplyAt: post.lastReplyAt,
      status: post.status,
      isLiked,
      isFavorited,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  async create(dto: CreatePostDto, authorId: string): Promise<Post> {
    const bar = await this.barsRepository.findOne({ where: { id: dto.barId } });
    if (!bar) throw new NotFoundException('Bar not found');
    if (bar.status !== 'active') {
      throw new ForbiddenException('Bar does not allow posting in its current status');
    }

    const post = this.postsRepository.create({
      barId: dto.barId,
      authorId,
      title: dto.title,
      content: dto.content,
      contentType: dto.contentType ?? 'plaintext',
    });
    const saved = await this.postsRepository.save(post);

    const createdPost = await this.postsRepository.findOne({
      where: { id: saved.id },
      relations: ['author', 'bar'],
    });

    if (!createdPost) {
      throw new InternalServerErrorException('Failed to load created post');
    }

    return createdPost;
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['bar'],
    });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    await this.checkBarManageable(post.barId);

    const isAuthor = post.authorId === userId;
    let isBarStaff = false;
    if (!isAuthor) {
      const membership = await this.barMembersRepository.findOne({
        where: { barId: post.barId, userId },
      });
      isBarStaff = !!membership && (membership.role === 'owner' || membership.role === 'moderator');
    }

    if (!isAuthor && !isBarStaff) {
      throw new ForbiddenException('No permission to delete this post');
    }

    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Reply)
        .set({ deletedAt: now, status: 'deleted' })
        .where('post_id = :postId AND deleted_at IS NULL', { postId })
        .execute();

      await manager.update(Post, postId, {
        deletedAt: now,
        status: 'deleted',
      });

      this.logger.log(`Post deleted: postId=${postId}, userId=${userId}`);
    });
  }

  async sharePost(postId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'hidden') {
      throw new NotFoundException('Post not found');
    }

    await this.postsRepository.increment({ id: postId }, 'shareCount', 1);
    const updated = await this.postsRepository.findOne({ where: { id: postId } });

    return {
      shareUrl: `/posts/${postId}`,
      shareCount: updated!.shareCount,
    };
  }

  async hidePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    await this.checkBarManageable(post.barId);

    const membership = await this.barMembersRepository.findOne({
      where: { barId: post.barId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
      throw new ForbiddenException('No permission to hide this post');
    }

    if (post.status === 'hidden') {
      return post;
    }

    post.status = 'hidden';
    const saved = await this.postsRepository.save(post);
    this.logger.log(`Post hidden: postId=${postId}, userId=${userId}`);
    return saved;
  }

  async unhidePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    await this.checkBarManageable(post.barId);

    const membership = await this.barMembersRepository.findOne({
      where: { barId: post.barId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
      throw new ForbiddenException('No permission to unhide this post');
    }

    if (post.status !== 'hidden') {
      return post;
    }

    post.status = 'published';
    const saved = await this.postsRepository.save(post);
    this.logger.log(`Post unhidden: postId=${postId}, userId=${userId}`);
    return saved;
  }

  async incrementReplyCount(postId: string, replyAt: Date): Promise<void> {
    await this.postsRepository.increment({ id: postId }, 'replyCount', 1);
    await this.postsRepository.update(postId, { lastReplyAt: replyAt });
  }

  async decrementReplyCount(postId: string): Promise<void> {
    await this.postsRepository.decrement({ id: postId }, 'replyCount', 1);
  }
}
