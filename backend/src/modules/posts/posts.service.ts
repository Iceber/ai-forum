import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Post } from './post.entity';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async findAll(barId?: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const where: Record<string, unknown> = {};

    if (barId) where['barId'] = barId;

    if (cursor) {
      const decodedDate = new Date(
        Buffer.from(cursor, 'base64').toString('utf8'),
      );
      where['createdAt'] = LessThan(decodedDate);
    }

    const posts = await this.postsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: take + 1,
      relations: ['author'],
    });

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

  async findOne(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'bar'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(dto: CreatePostDto, authorId: string): Promise<Post> {
    const post = this.postsRepository.create({
      barId: dto.barId,
      authorId,
      title: dto.title,
      content: dto.content,
      contentType: dto.contentType ?? 'plaintext',
    });
    return this.postsRepository.save(post);
  }

  async incrementReplyCount(postId: string, replyAt: Date): Promise<void> {
    await this.postsRepository.increment({ id: postId }, 'replyCount', 1);
    await this.postsRepository.update(postId, { lastReplyAt: replyAt });
  }
}
