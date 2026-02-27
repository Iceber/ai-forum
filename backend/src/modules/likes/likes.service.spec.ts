import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LikesService } from './likes.service';
import { UserLike } from './user-like.entity';
import { Post } from '../posts/post.entity';
import { Reply } from '../replies/reply.entity';

const mockPost = {
  id: '00000000-0000-4000-a000-000000000001',
  status: 'published',
  deletedAt: null,
  likeCount: 5,
};

const mockReply = {
  id: '00000000-0000-4000-a000-000000000002',
  status: 'published',
  deletedAt: null,
  likeCount: 3,
};

const userId = '00000000-0000-4000-a000-000000000010';

const mockManager = {
  create: jest.fn().mockImplementation((_entity, data) => ({ id: 'new-like-id', ...data })),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  remove: jest.fn().mockResolvedValue(undefined),
  increment: jest.fn().mockResolvedValue(undefined),
  decrement: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
};

describe('LikesService', () => {
  let service: LikesService;
  let likesRepo: Record<string, jest.Mock>;
  let postsRepo: Record<string, jest.Mock>;
  let repliesRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    likesRepo = { findOne: jest.fn() };
    postsRepo = { findOne: jest.fn() };
    repliesRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(UserLike), useValue: likesRepo },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: getRepositoryToken(Reply), useValue: repliesRepo },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
          },
        },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
    jest.clearAllMocks();
  });

  describe('likePost', () => {
    it('should create like and increment count when post exists and not yet liked', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      likesRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue({ ...mockPost, likeCount: 6 });

      const result = await service.likePost(mockPost.id, userId);

      expect(result.isLiked).toBe(true);
      expect(result.likeCount).toBe(6);
      expect(mockManager.save).toHaveBeenCalled();
      expect(mockManager.increment).toHaveBeenCalledWith(
        Post,
        { id: mockPost.id },
        'likeCount',
        1,
      );
    });

    it('should throw NotFoundException when post not found', async () => {
      postsRepo.findOne.mockResolvedValue(null);

      await expect(service.likePost('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when post is deleted', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, deletedAt: new Date() });

      await expect(service.likePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when post is hidden', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, status: 'hidden' });

      await expect(service.likePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already liked', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      likesRepo.findOne.mockResolvedValue({ id: 'existing-like' });

      await expect(service.likePost(mockPost.id, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unlikePost', () => {
    it('should remove like and decrement count when like exists', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      likesRepo.findOne.mockResolvedValue({ id: 'existing-like' });
      mockManager.findOne.mockResolvedValue({ ...mockPost, likeCount: 4 });

      const result = await service.unlikePost(mockPost.id, userId);

      expect(result.isLiked).toBe(false);
      expect(result.likeCount).toBe(4);
      expect(mockManager.remove).toHaveBeenCalled();
      expect(mockManager.decrement).toHaveBeenCalledWith(
        Post,
        { id: mockPost.id },
        'likeCount',
        1,
      );
    });

    it('should throw NotFoundException when post not found', async () => {
      postsRepo.findOne.mockResolvedValue(null);

      await expect(service.unlikePost('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when post is deleted', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, deletedAt: new Date() });

      await expect(service.unlikePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when not liked', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      likesRepo.findOne.mockResolvedValue(null);

      await expect(service.unlikePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('likeReply', () => {
    it('should create like and increment count when reply exists and not yet liked', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply });
      likesRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue({ ...mockReply, likeCount: 4 });

      const result = await service.likeReply(mockReply.id, userId);

      expect(result.isLiked).toBe(true);
      expect(result.likeCount).toBe(4);
      expect(mockManager.save).toHaveBeenCalled();
      expect(mockManager.increment).toHaveBeenCalledWith(
        Reply,
        { id: mockReply.id },
        'likeCount',
        1,
      );
    });

    it('should throw NotFoundException when reply not found', async () => {
      repliesRepo.findOne.mockResolvedValue(null);

      await expect(service.likeReply('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when reply is deleted', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply, deletedAt: new Date() });

      await expect(service.likeReply(mockReply.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when reply is hidden', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply, status: 'hidden' });

      await expect(service.likeReply(mockReply.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already liked', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply });
      likesRepo.findOne.mockResolvedValue({ id: 'existing-like' });

      await expect(service.likeReply(mockReply.id, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unlikeReply', () => {
    it('should remove like and decrement count when like exists', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply });
      likesRepo.findOne.mockResolvedValue({ id: 'existing-like' });
      mockManager.findOne.mockResolvedValue({ ...mockReply, likeCount: 2 });

      const result = await service.unlikeReply(mockReply.id, userId);

      expect(result.isLiked).toBe(false);
      expect(result.likeCount).toBe(2);
      expect(mockManager.remove).toHaveBeenCalled();
      expect(mockManager.decrement).toHaveBeenCalledWith(
        Reply,
        { id: mockReply.id },
        'likeCount',
        1,
      );
    });

    it('should throw NotFoundException when reply not found', async () => {
      repliesRepo.findOne.mockResolvedValue(null);

      await expect(service.unlikeReply('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when reply is deleted', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply, deletedAt: new Date() });

      await expect(service.unlikeReply(mockReply.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when not liked', async () => {
      repliesRepo.findOne.mockResolvedValue({ ...mockReply });
      likesRepo.findOne.mockResolvedValue(null);

      await expect(service.unlikeReply(mockReply.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isLiked', () => {
    it('should return true when user has liked the target', async () => {
      likesRepo.findOne.mockResolvedValue({ id: 'like-id' });

      expect(await service.isLiked(userId, 'post', mockPost.id)).toBe(true);
    });

    it('should return false when user has not liked the target', async () => {
      likesRepo.findOne.mockResolvedValue(null);

      expect(await service.isLiked(userId, 'post', mockPost.id)).toBe(false);
    });
  });
});
