import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PostsService } from './posts.service';
import { Post } from './post.entity';
import { Reply } from '../replies/reply.entity';
import { Bar } from '../bars/bar.entity';
import { BarMember } from '../bars/bar-member.entity';
import { UserLike } from '../likes/user-like.entity';
import { UserFavorite } from '../favorites/user-favorite.entity';

const mockPost = {
  id: 'post-uuid-1',
  barId: 'bar-uuid-1',
  authorId: 'user-uuid-1',
  title: 'Test Post',
  content: 'Hello world',
  contentType: 'plaintext',
  replyCount: 0,
  likeCount: 0,
  favoriteCount: 0,
  shareCount: 0,
  lastReplyAt: null,
  status: 'published',
  deletedAt: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  bar: { id: 'bar-uuid-1', name: 'Test Bar', status: 'active' },
  author: { id: 'user-uuid-1', nickname: 'Alice' },
};

const mockBar = { id: 'bar-uuid-1', name: 'Test Bar', status: 'active' };

const createMockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createMockQueryBuilder = (results: any[] = []) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(results),
});

describe('PostsService', () => {
  let service: PostsService;
  let postRepo: ReturnType<typeof createMockRepo>;
  let barRepo: ReturnType<typeof createMockRepo>;
  let barMemberRepo: ReturnType<typeof createMockRepo>;
  let likesRepo: ReturnType<typeof createMockRepo>;
  let favoritesRepo: ReturnType<typeof createMockRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    postRepo = createMockRepo();
    barRepo = createMockRepo();
    barMemberRepo = createMockRepo();
    likesRepo = createMockRepo();
    favoritesRepo = createMockRepo();
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: postRepo },
        { provide: getRepositoryToken(Reply), useValue: createMockRepo() },
        { provide: getRepositoryToken(Bar), useValue: barRepo },
        { provide: getRepositoryToken(BarMember), useValue: barMemberRepo },
        { provide: getRepositoryToken(UserLike), useValue: likesRepo },
        { provide: getRepositoryToken(UserFavorite), useValue: favoritesRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  describe('findAll', () => {
    it('should return paginated posts without cursor', async () => {
      const qb = createMockQueryBuilder([mockPost]);
      postRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
    });

    it('should return hasMore=true and next cursor when more items exist', async () => {
      const posts = Array.from({ length: 21 }, (_, i) => ({
        ...mockPost,
        id: `post-${i}`,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
      }));
      const qb = createMockQueryBuilder(posts);
      postRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(undefined, undefined, 20);

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).not.toBeNull();
    });

    it('should filter by barId when provided', async () => {
      const qb = createMockQueryBuilder([mockPost]);
      postRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('bar-uuid-1');

      expect(qb.andWhere).toHaveBeenCalledWith('post.barId = :barId', { barId: 'bar-uuid-1' });
    });
  });

  describe('findOne', () => {
    it('should return a post by id with isLiked/isFavorited when userId provided', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost } as any);
      likesRepo.findOne.mockResolvedValue(null);
      favoritesRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('post-uuid-1', 'user-uuid-1');

      expect(result.id).toBe('post-uuid-1');
      expect(result.isLiked).toBe(false);
      expect(result.isFavorited).toBe(false);
    });

    it('should return null isLiked/isFavorited when no userId', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost } as any);

      const result = await service.findOne('post-uuid-1');

      expect(result.isLiked).toBeNull();
      expect(result.isFavorited).toBeNull();
    });

    it('should throw NotFoundException if post not found', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for deleted post when not author', async () => {
      postRepo.findOne.mockResolvedValue({
        ...mockPost,
        status: 'deleted',
        deletedAt: new Date(),
      } as any);

      await expect(service.findOne('post-uuid-1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for hidden post when no userId', async () => {
      postRepo.findOne.mockResolvedValue({
        ...mockPost,
        status: 'hidden',
      } as any);

      await expect(service.findOne('post-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create, save, and return post with author and bar relations', async () => {
      const postWithRelations = { ...mockPost };
      barRepo.findOne.mockResolvedValue(mockBar as any);
      postRepo.create.mockReturnValue(mockPost as any);
      postRepo.save.mockResolvedValue(mockPost as any);
      postRepo.findOne.mockResolvedValue(postWithRelations as any);

      const result = await service.create(
        { barId: 'bar-uuid-1', title: 'Test Post', content: 'Hello world' },
        'user-uuid-1',
      );

      expect(result).toEqual(postWithRelations);
      expect(postRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when bar not found', async () => {
      barRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ barId: 'bad-bar', title: 'T', content: 'C' }, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when bar is not active', async () => {
      barRepo.findOne.mockResolvedValue({ ...mockBar, status: 'suspended' } as any);

      await expect(
        service.create({ barId: 'bar-uuid-1', title: 'T', content: 'C' }, 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePost', () => {
    it('should throw NotFoundException when post not found', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.deletePost('bad-id', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user has no permission', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost, authorId: 'other-user' } as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      barMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.deletePost('post-uuid-1', 'user-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft delete post and replies when author deletes', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost } as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue(undefined),
          }),
          update: jest.fn().mockResolvedValue(undefined),
        };
        return cb(mockManager);
      });

      await service.deletePost('post-uuid-1', 'user-uuid-1');

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('sharePost', () => {
    it('should increment share count and return share info', async () => {
      postRepo.findOne
        .mockResolvedValueOnce({ ...mockPost } as any)
        .mockResolvedValueOnce({ ...mockPost, shareCount: 1 } as any);
      postRepo.increment.mockResolvedValue(undefined as any);

      const result = await service.sharePost('post-uuid-1');

      expect(result.postId).toBe('post-uuid-1');
      expect(result.shareCount).toBe(1);
    });

    it('should throw NotFoundException for deleted post', async () => {
      postRepo.findOne.mockResolvedValue({
        ...mockPost,
        deletedAt: new Date(),
      } as any);

      await expect(service.sharePost('post-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hidePost', () => {
    it('should hide post when user is moderator', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost } as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      barMemberRepo.findOne.mockResolvedValue({ role: 'moderator' } as any);
      postRepo.save.mockResolvedValue({ ...mockPost, status: 'hidden' } as any);

      const result = await service.hidePost('post-uuid-1', 'mod-user');

      expect(postRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not moderator/owner', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost } as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      barMemberRepo.findOne.mockResolvedValue({ role: 'member' } as any);

      await expect(service.hidePost('post-uuid-1', 'user-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should be idempotent when post is already hidden', async () => {
      const hiddenPost = { ...mockPost, status: 'hidden' };
      postRepo.findOne.mockResolvedValue(hiddenPost as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      barMemberRepo.findOne.mockResolvedValue({ role: 'owner' } as any);

      const result = await service.hidePost('post-uuid-1', 'owner-user');

      expect(postRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(hiddenPost);
    });
  });

  describe('unhidePost', () => {
    it('should unhide post when user is moderator', async () => {
      const hiddenPost = { ...mockPost, status: 'hidden' as const };
      postRepo.findOne.mockResolvedValue(hiddenPost as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      barMemberRepo.findOne.mockResolvedValue({ role: 'moderator' } as any);
      postRepo.save.mockResolvedValue({ ...mockPost, status: 'published' } as any);

      const result = await service.unhidePost('post-uuid-1', 'mod-user');

      expect(postRepo.save).toHaveBeenCalled();
    });

    it('should be idempotent when post is not hidden', async () => {
      postRepo.findOne.mockResolvedValue({ ...mockPost } as any);
      barRepo.findOne.mockResolvedValue(mockBar as any);
      barMemberRepo.findOne.mockResolvedValue({ role: 'owner' } as any);

      const result = await service.unhidePost('post-uuid-1', 'owner-user');

      expect(postRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('incrementReplyCount', () => {
    it('should increment reply count and update lastReplyAt', async () => {
      postRepo.increment.mockResolvedValue(undefined as any);
      postRepo.update.mockResolvedValue(undefined as any);

      const now = new Date();
      await service.incrementReplyCount('post-uuid-1', now);

      expect(postRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1' },
        'replyCount',
        1,
      );
      expect(postRepo.update).toHaveBeenCalledWith('post-uuid-1', {
        lastReplyAt: now,
      });
    });
  });

  describe('decrementReplyCount', () => {
    it('should decrement reply count', async () => {
      postRepo.decrement.mockResolvedValue(undefined as any);

      await service.decrementReplyCount('post-uuid-1');

      expect(postRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1' },
        'replyCount',
        1,
      );
    });
  });
});
