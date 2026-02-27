import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FavoritesService } from './favorites.service';
import { UserFavorite } from './user-favorite.entity';
import { Post } from '../posts/post.entity';

const mockPost = {
  id: '00000000-0000-4000-a000-000000000001',
  status: 'published',
  deletedAt: null,
  favoriteCount: 3,
};

const userId = '00000000-0000-4000-a000-000000000010';

const mockManager = {
  create: jest.fn().mockImplementation((_entity, data) => ({ id: 'new-fav-id', ...data })),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  remove: jest.fn().mockResolvedValue(undefined),
  increment: jest.fn().mockResolvedValue(undefined),
  decrement: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
};

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoritesRepo: Record<string, jest.Mock>;
  let postsRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    favoritesRepo = { findOne: jest.fn() };
    postsRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(UserFavorite), useValue: favoritesRepo },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
          },
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    jest.clearAllMocks();
  });

  describe('favoritePost', () => {
    it('should create favorite and increment count when post exists and not yet favorited', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      favoritesRepo.findOne.mockResolvedValue(null);
      mockManager.findOne.mockResolvedValue({ ...mockPost, favoriteCount: 4 });

      const result = await service.favoritePost(mockPost.id, userId);

      expect(result.isFavorited).toBe(true);
      expect(result.favoriteCount).toBe(4);
      expect(mockManager.save).toHaveBeenCalled();
      expect(mockManager.increment).toHaveBeenCalledWith(
        Post,
        { id: mockPost.id },
        'favoriteCount',
        1,
      );
    });

    it('should throw NotFoundException when post not found', async () => {
      postsRepo.findOne.mockResolvedValue(null);

      await expect(service.favoritePost('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when post is deleted', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, deletedAt: new Date() });

      await expect(service.favoritePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when post is hidden', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, status: 'hidden' });

      await expect(service.favoritePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already favorited', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      favoritesRepo.findOne.mockResolvedValue({ id: 'existing-fav' });

      await expect(service.favoritePost(mockPost.id, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unfavoritePost', () => {
    it('should remove favorite and decrement count when favorite exists', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      favoritesRepo.findOne.mockResolvedValue({ id: 'existing-fav' });
      mockManager.findOne.mockResolvedValue({ ...mockPost, favoriteCount: 2 });

      const result = await service.unfavoritePost(mockPost.id, userId);

      expect(result.isFavorited).toBe(false);
      expect(result.favoriteCount).toBe(2);
      expect(mockManager.remove).toHaveBeenCalled();
      expect(mockManager.decrement).toHaveBeenCalledWith(
        Post,
        { id: mockPost.id },
        'favoriteCount',
        1,
      );
    });

    it('should throw NotFoundException when post not found', async () => {
      postsRepo.findOne.mockResolvedValue(null);

      await expect(service.unfavoritePost('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when post is deleted', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, deletedAt: new Date() });

      await expect(service.unfavoritePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when not favorited', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost });
      favoritesRepo.findOne.mockResolvedValue(null);

      await expect(service.unfavoritePost(mockPost.id, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isFavorited', () => {
    it('should return true when user has favorited the post', async () => {
      favoritesRepo.findOne.mockResolvedValue({ id: 'fav-id' });

      expect(await service.isFavorited(userId, mockPost.id)).toBe(true);
    });

    it('should return false when user has not favorited the post', async () => {
      favoritesRepo.findOne.mockResolvedValue(null);

      expect(await service.isFavorited(userId, mockPost.id)).toBe(false);
    });
  });
});
