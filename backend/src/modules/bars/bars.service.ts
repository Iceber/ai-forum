import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Bar } from './bar.entity';
import { BarMember } from './bar-member.entity';

@Injectable()
export class BarsService {
  constructor(
    @InjectRepository(Bar)
    private readonly barsRepository: Repository<Bar>,
    @InjectRepository(BarMember)
    private readonly barMembersRepository: Repository<BarMember>,
  ) {}

  async findAll(cursor?: string, limit = 20) {
    const take = Math.min(limit, 100);
    const where: Record<string, unknown> = {};

    if (cursor) {
      const decodedDate = new Date(
        Buffer.from(cursor, 'base64').toString('utf8'),
      );
      where['createdAt'] = LessThan(decodedDate);
    }

    const bars = await this.barsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: take + 1,
    });

    const hasMore = bars.length > take;
    const items = hasMore ? bars.slice(0, take) : bars;
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

  async findOne(id: string): Promise<Bar> {
    const bar = await this.barsRepository.findOne({ where: { id } });
    if (!bar) throw new NotFoundException('Bar not found');
    return bar;
  }

  // Used internally (e.g. seeding) to create a bar with owner membership
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
    const bar = this.barsRepository.create({
      ...data,
      createdById: userId,
    });
    const savedBar = await this.barsRepository.save(bar);

    const member = this.barMembersRepository.create({
      barId: savedBar.id,
      userId,
      role: 'owner',
    });
    await this.barMembersRepository.save(member);

    return savedBar;
  }
}
