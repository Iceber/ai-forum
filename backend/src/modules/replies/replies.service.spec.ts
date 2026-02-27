import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RepliesService } from './replies.service';
import { Reply } from './reply.entity';
import { Post } from '../posts/post.entity';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { UserLike } from '../likes/user-like.entity';
import { PostsService } from '../posts/posts.service';

const mockRepository = () => ({
  createQueryBuilder: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
});

describe('RepliesService', () => {
  let service: RepliesService;
  let repliesRepo: ReturnType<typeof mockRepository>;
  let postsRepo: ReturnType<typeof mockRepository>;
  let barsRepo: ReturnType<typeof mockRepository>;
  let barMembersRepo: ReturnType<typeof mockRepository>;
  let likesRepo: ReturnType<typeof mockRepository>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepliesService,
        { provide: getRepositoryToken(Reply), useFactory: mockRepository },
        { provide: getRepositoryToken(Post), useFactory: mockRepository },
        { provide: getRepositoryToken(Bar), useFactory: mockRepository },
        { provide: getRepositoryToken(BarMember), useFactory: mockRepository },
        { provide: getRepositoryToken(UserLike), useFactory: mockRepository },
        {
          provide: PostsService,
          useValue: {
            findOne: jest.fn(),
            incrementReplyCount: jest.fn(),
          },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<RepliesService>(RepliesService);
    repliesRepo = module.get(getRepositoryToken(Reply));
    postsRepo = module.get(getRepositoryToken(Post));
    barsRepo = module.get(getRepositoryToken(Bar));
    barMembersRepo = module.get(getRepositoryToken(BarMember));
    likesRepo = module.get(getRepositoryToken(UserLike));
  });

  describe('create', () => {
    it('should return created reply with author relation when save succeeds', async () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const savedReply = { id: 'reply-uuid-1', createdAt };
      const replyWithAuthor = {
        ...savedReply,
        author: { id: 'user-uuid-1', nickname: 'Alice' },
      };

      postsRepo.findOne.mockResolvedValue({
        id: 'post-uuid-1',
        status: 'published',
        deletedAt: null,
      });

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ maxFloor: 2 }),
        }),
        create: jest.fn().mockReturnValue(savedReply),
        save: jest.fn().mockResolvedValue(savedReply),
        increment: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(replyWithAuthor),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      const result = await service.create(
        'post-uuid-1',
        { content: 'hello' },
        'user-uuid-1',
      );

      expect(result).toEqual(replyWithAuthor);
      expect(mockManager.findOne).toHaveBeenCalledWith(Reply, {
        where: { id: 'reply-uuid-1' },
        relations: ['author'],
      });
      expect(mockManager.increment).toHaveBeenCalledWith(
        Post,
        { id: 'post-uuid-1' },
        'replyCount',
        1,
      );
    });

    it('should throw InternalServerErrorException when created reply cannot be loaded', async () => {
      const savedReply = {
        id: 'reply-uuid-1',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      postsRepo.findOne.mockResolvedValue({
        id: 'post-uuid-1',
        status: 'published',
        deletedAt: null,
      });

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ maxFloor: 0 }),
        }),
        create: jest.fn().mockReturnValue(savedReply),
        save: jest.fn().mockResolvedValue(savedReply),
        increment: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(
        service.create('post-uuid-1', { content: 'hello' }, 'user-uuid-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw NotFoundException when post does not exist', async () => {
      postsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('post-uuid-1', { content: 'hello' }, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when post is deleted', async () => {
      postsRepo.findOne.mockResolvedValue({
        id: 'post-uuid-1',
        status: 'published',
        deletedAt: new Date(),
      });

      await expect(
        service.create('post-uuid-1', { content: 'hello' }, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should increment parent childCount for child replies', async () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const savedReply = { id: 'reply-uuid-2', createdAt };
      const replyWithAuthor = {
        ...savedReply,
        author: { id: 'user-uuid-1', nickname: 'Alice' },
      };

      postsRepo.findOne.mockResolvedValue({
        id: 'post-uuid-1',
        status: 'published',
        deletedAt: null,
      });
      repliesRepo.findOne.mockResolvedValue({
        id: 'parent-reply-1',
        postId: 'post-uuid-1',
        deletedAt: null,
        status: 'published',
      });

      const mockManager = {
        create: jest.fn().mockReturnValue(savedReply),
        save: jest.fn().mockResolvedValue(savedReply),
        increment: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(replyWithAuthor),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await service.create(
        'post-uuid-1',
        { content: 'child reply', parentReplyId: 'parent-reply-1' },
        'user-uuid-1',
      );

      expect(mockManager.increment).toHaveBeenCalledWith(
        Reply,
        { id: 'parent-reply-1' },
        'childCount',
        1,
      );
    });
  });

  describe('findChildren', () => {
    it('should throw NotFoundException when parent reply does not exist', async () => {
      repliesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findChildren('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteReply', () => {
    it('should throw NotFoundException when reply does not exist', async () => {
      repliesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteReply('nonexistent-id', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user has no permission', async () => {
      repliesRepo.findOne.mockResolvedValue({
        id: 'reply-uuid-1',
        authorId: 'other-user',
        deletedAt: null,
        childCount: 0,
        parentReplyId: null,
        post: { id: 'post-uuid-1', barId: 'bar-uuid-1' },
      });
      barsRepo.findOne.mockResolvedValue({ id: 'bar-uuid-1', status: 'active' });
      barMembersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteReply('reply-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('hideReply', () => {
    it('should throw NotFoundException when reply does not exist', async () => {
      repliesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.hideReply('nonexistent-id', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not bar staff', async () => {
      repliesRepo.findOne.mockResolvedValue({
        id: 'reply-uuid-1',
        deletedAt: null,
        post: { id: 'post-uuid-1', barId: 'bar-uuid-1' },
      });
      barsRepo.findOne.mockResolvedValue({ id: 'bar-uuid-1', status: 'active' });
      barMembersRepo.findOne.mockResolvedValue({ role: 'member' });

      await expect(
        service.hideReply('reply-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('unhideReply', () => {
    it('should throw NotFoundException when reply does not exist', async () => {
      repliesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.unhideReply('nonexistent-id', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not bar staff', async () => {
      repliesRepo.findOne.mockResolvedValue({
        id: 'reply-uuid-1',
        deletedAt: null,
        status: 'hidden',
        post: { id: 'post-uuid-1', barId: 'bar-uuid-1' },
      });
      barsRepo.findOne.mockResolvedValue({ id: 'bar-uuid-1', status: 'active' });
      barMembersRepo.findOne.mockResolvedValue({ role: 'member' });

      await expect(
        service.unhideReply('reply-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
