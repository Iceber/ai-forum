import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Reply } from './reply.entity';
import { CreateReplyDto } from './dto/create-reply.dto';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class RepliesService {
  constructor(
    @InjectRepository(Reply)
    private readonly repliesRepository: Repository<Reply>,
    private readonly postsService: PostsService,
  ) {}

  async findByPost(postId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);

    let afterFloor = 0;
    if (cursor) {
      afterFloor = parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10);
    }

    const where: Record<string, unknown> = { postId };
    if (afterFloor > 0) {
      where['floorNumber'] = MoreThan(afterFloor);
    }

    const replies = await this.repliesRepository.find({
      where,
      order: { floorNumber: 'ASC' },
      take: take + 1,
      relations: ['author'],
    });

    const hasMore = replies.length > take;
    const items = hasMore ? replies.slice(0, take) : replies;
    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(String(items[items.length - 1].floorNumber)).toString(
            'base64',
          )
        : null;

    return {
      data: items,
      meta: { cursor: nextCursor, hasMore },
      error: null,
    };
  }

  async create(
    postId: string,
    dto: CreateReplyDto,
    authorId: string,
  ): Promise<Reply> {
    // Verify post exists
    await this.postsService.findOne(postId);

    // Calculate next floor number atomically
    const result = await this.repliesRepository
      .createQueryBuilder('reply')
      .select('MAX(reply.floor_number)', 'maxFloor')
      .where('reply.post_id = :postId', { postId })
      .getRawOne<{ maxFloor: number | null }>();

    const floorNumber = (result?.maxFloor ?? 0) + 1;

    const reply = this.repliesRepository.create({
      postId,
      authorId,
      parentReplyId: dto.parentReplyId ?? null,
      floorNumber,
      content: dto.content,
      contentType: dto.contentType ?? 'plaintext',
    });

    const saved = await this.repliesRepository.save(reply);

    // Update post's reply_count and last_reply_at
    await this.postsService.incrementReplyCount(postId, saved.createdAt);

    return saved;
  }
}
