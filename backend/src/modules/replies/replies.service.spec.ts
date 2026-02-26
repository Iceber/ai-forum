import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepliesService } from './replies.service';
import { Reply } from './reply.entity';
import { PostsService } from '../posts/posts.service';

type MockRepo = jest.Mocked<
  Pick<
    Repository<Reply>,
    'createQueryBuilder' | 'create' | 'save' | 'findOne'
  >
>;

describe('RepliesService', () => {
  let service: RepliesService;
  let repo: MockRepo;
  let postsService: jest.Mocked<
    Pick<PostsService, 'findOne' | 'incrementReplyCount'>
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepliesService,
        {
          provide: getRepositoryToken(Reply),
          useValue: {
            createQueryBuilder: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: PostsService,
          useValue: {
            findOne: jest.fn(),
            incrementReplyCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RepliesService>(RepliesService);
    repo = module.get(getRepositoryToken(Reply));
    postsService = module.get(PostsService);
  });

  describe('create', () => {
    it('should return created reply with author relation when save succeeds', async () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const savedReply = { id: 'reply-uuid-1', createdAt };
      const replyWithAuthor = {
        ...savedReply,
        author: { id: 'user-uuid-1', nickname: 'Alice' },
      };
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxFloor: 2 }),
      };

      postsService.findOne.mockResolvedValue({ id: 'post-uuid-1' } as any);
      repo.createQueryBuilder.mockReturnValue(qb as any);
      repo.create.mockReturnValue(savedReply as any);
      repo.save.mockResolvedValue(savedReply as any);
      repo.findOne.mockResolvedValue(replyWithAuthor as any);

      const result = await service.create(
        'post-uuid-1',
        { content: 'hello' },
        'user-uuid-1',
      );

      expect(result).toEqual(replyWithAuthor);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'reply-uuid-1' },
        relations: ['author'],
      });
      expect(postsService.incrementReplyCount).toHaveBeenCalledWith(
        'post-uuid-1',
        createdAt,
      );
    });

    it('should throw InternalServerErrorException when created reply cannot be loaded', async () => {
      const savedReply = {
        id: 'reply-uuid-1',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxFloor: 0 }),
      };

      postsService.findOne.mockResolvedValue({ id: 'post-uuid-1' } as any);
      repo.createQueryBuilder.mockReturnValue(qb as any);
      repo.create.mockReturnValue(savedReply as any);
      repo.save.mockResolvedValue(savedReply as any);
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.create('post-uuid-1', { content: 'hello' }, 'user-uuid-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
