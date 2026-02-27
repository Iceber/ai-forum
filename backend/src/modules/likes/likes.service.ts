import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserLike } from './user-like.entity';
import { Post } from '../posts/post.entity';
import { Reply } from '../replies/reply.entity';

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(
    @InjectRepository(UserLike)
    private readonly likesRepository: Repository<UserLike>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Reply)
    private readonly repliesRepository: Repository<Reply>,
    private readonly dataSource: DataSource,
  ) {}

  async likePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'hidden') {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.likesRepository.findOne({
      where: { userId, targetType: 'post', targetId: postId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Already liked this post',
        error: 'ALREADY_LIKED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const like = manager.create(UserLike, {
        userId,
        targetType: 'post',
        targetId: postId,
      });
      await manager.save(like);
      await manager.increment(Post, { id: postId }, 'likeCount', 1);

      const updated = await manager.findOne(Post, { where: { id: postId } });
      this.logger.log(`Post liked: postId=${postId}, userId=${userId}`);
      return { isLiked: true, likeCount: updated!.likeCount };
    });
  }

  async unlikePost(postId: string, userId: string) {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'hidden') {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.likesRepository.findOne({
      where: { userId, targetType: 'post', targetId: postId },
    });
    if (!existing) {
      throw new NotFoundException('Not liked');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.remove(existing);
      await manager.decrement(Post, { id: postId }, 'likeCount', 1);

      const updated = await manager.findOne(Post, { where: { id: postId } });
      this.logger.log(`Post unliked: postId=${postId}, userId=${userId}`);
      return { isLiked: false, likeCount: updated!.likeCount };
    });
  }

  async likeReply(replyId: string, userId: string) {
    const reply = await this.repliesRepository.findOne({ where: { id: replyId } });
    if (!reply || reply.deletedAt || reply.status === 'hidden') {
      throw new NotFoundException('Reply not found');
    }

    const existing = await this.likesRepository.findOne({
      where: { userId, targetType: 'reply', targetId: replyId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Already liked this reply',
        error: 'ALREADY_LIKED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const like = manager.create(UserLike, {
        userId,
        targetType: 'reply',
        targetId: replyId,
      });
      await manager.save(like);
      await manager.increment(Reply, { id: replyId }, 'likeCount', 1);

      const updated = await manager.findOne(Reply, { where: { id: replyId } });
      this.logger.log(`Reply liked: replyId=${replyId}, userId=${userId}`);
      return { isLiked: true, likeCount: updated!.likeCount };
    });
  }

  async unlikeReply(replyId: string, userId: string) {
    const reply = await this.repliesRepository.findOne({ where: { id: replyId } });
    if (!reply || reply.deletedAt || reply.status === 'hidden') {
      throw new NotFoundException('Reply not found');
    }

    const existing = await this.likesRepository.findOne({
      where: { userId, targetType: 'reply', targetId: replyId },
    });
    if (!existing) {
      throw new NotFoundException('Not liked');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.remove(existing);
      await manager.decrement(Reply, { id: replyId }, 'likeCount', 1);

      const updated = await manager.findOne(Reply, { where: { id: replyId } });
      this.logger.log(`Reply unliked: replyId=${replyId}, userId=${userId}`);
      return { isLiked: false, likeCount: updated!.likeCount };
    });
  }

  async isLiked(userId: string, targetType: 'post' | 'reply', targetId: string): Promise<boolean> {
    const like = await this.likesRepository.findOne({
      where: { userId, targetType, targetId },
    });
    return !!like;
  }
}
