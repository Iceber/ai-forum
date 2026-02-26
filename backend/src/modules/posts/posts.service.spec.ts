import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostsService } from './posts.service';
import { Post } from './post.entity';

const mockPost = {
  id: 'post-uuid-1',
  barId: 'bar-uuid-1',
  authorId: 'user-uuid-1',
  title: 'Test Post',
  content: 'Hello world',
  contentType: 'plaintext',
  replyCount: 0,
  lastReplyAt: null,
  status: 'published',
  deletedAt: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

type MockRepo = jest.Mocked<Pick<Repository<Post>, 'find' | 'findOne' | 'create' | 'save' | 'increment' | 'update'>>;

describe('PostsService', () => {
  let service: PostsService;
  let repo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            increment: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    repo = module.get(getRepositoryToken(Post));
  });

  describe('findAll', () => {
    it('should return paginated posts without cursor', async () => {
      const posts = [mockPost];
      repo.find.mockResolvedValue(posts as any);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['author', 'bar'],
        }),
      );
    });

    it('should return hasMore=true and next cursor when more items exist', async () => {
      // Return limit+1 items to indicate more pages
      const posts = Array.from({ length: 21 }, (_, i) => ({
        ...mockPost,
        id: `post-${i}`,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
      }));
      repo.find.mockResolvedValue(posts as any);

      const result = await service.findAll(undefined, undefined, 20);

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).not.toBeNull();
    });

    it('should filter by barId when provided', async () => {
      repo.find.mockResolvedValue([mockPost] as any);

      await service.findAll('bar-uuid-1');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ barId: 'bar-uuid-1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a post by id', async () => {
      repo.findOne.mockResolvedValue(mockPost as any);

      const result = await service.findOne('post-uuid-1');

      expect(result.id).toBe('post-uuid-1');
    });

    it('should throw NotFoundException if post not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and save a new post', async () => {
      repo.create.mockReturnValue(mockPost as any);
      repo.save.mockResolvedValue(mockPost as any);

      const result = await service.create(
        {
          barId: 'bar-uuid-1',
          title: 'Test Post',
          content: 'Hello world',
        },
        'user-uuid-1',
      );

      expect(result.id).toBe('post-uuid-1');
      expect(repo.save).toHaveBeenCalledWith(mockPost);
    });
  });

  describe('incrementReplyCount', () => {
    it('should increment reply count and update lastReplyAt', async () => {
      repo.increment.mockResolvedValue(undefined as any);
      repo.update.mockResolvedValue(undefined as any);

      const now = new Date();
      await service.incrementReplyCount('post-uuid-1', now);

      expect(repo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1' },
        'replyCount',
        1,
      );
      expect(repo.update).toHaveBeenCalledWith('post-uuid-1', {
        lastReplyAt: now,
      });
    });
  });
});
