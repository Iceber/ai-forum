import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BarsService } from './bars.service';
import { Bar } from './bar.entity';
import { BarMember } from './bar-member.entity';

const mockBar: Partial<Bar> = {
  id: '00000000-0000-4000-a000-000000000001',
  name: 'Test Bar',
  description: 'A test bar',
  avatarUrl: null,
  rules: null,
  category: null,
  status: 'active',
  statusReason: null,
  suspendUntil: null,
  memberCount: 5,
  createdById: '00000000-0000-4000-a000-000000000010',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockMember: Partial<BarMember> = {
  id: '00000000-0000-4000-a000-000000000100',
  barId: mockBar.id,
  userId: '00000000-0000-4000-a000-000000000020',
  role: 'member',
  joinedAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockManagerSaved: Record<string, unknown> = {};

const mockManager = {
  create: jest.fn().mockImplementation((_entity, data) => ({ ...data })),
  save: jest.fn().mockImplementation((entity) => {
    const saved = { id: '00000000-0000-4000-a000-000000000099', ...entity };
    Object.assign(mockManagerSaved, saved);
    return Promise.resolve(saved);
  }),
  remove: jest.fn().mockResolvedValue(undefined),
  increment: jest.fn().mockResolvedValue(undefined),
  decrement: jest.fn().mockResolvedValue(undefined),
};

describe('BarsService', () => {
  let service: BarsService;
  let barsRepository: Record<string, jest.Mock>;
  let barMembersRepository: Record<string, jest.Mock>;

  beforeEach(async () => {
    barsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    barMembersRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarsService,
        {
          provide: getRepositoryToken(Bar),
          useValue: barsRepository,
        },
        {
          provide: getRepositoryToken(BarMember),
          useValue: barMembersRepository,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation((cb: (manager: any) => Promise<unknown>) =>
                cb(mockManager),
              ),
          },
        },
      ],
    }).compile();

    service = module.get<BarsService>(BarsService);

    jest.clearAllMocks();
  });

  describe('autoUnsuspendIfExpired', () => {
    it('should return null when bar not found', async () => {
      barsRepository.findOne.mockResolvedValue(null);

      const result = await service.autoUnsuspendIfExpired('non-existent-id');

      expect(result).toBeNull();
      expect(barsRepository.save).not.toHaveBeenCalled();
    });

    it('should auto-unsuspend when bar is suspended and suspend_until has passed', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const suspendedBar = {
        ...mockBar,
        status: 'suspended',
        suspendUntil: pastDate,
        statusReason: 'rule violation',
      };
      barsRepository.findOne.mockResolvedValue(suspendedBar);
      barsRepository.save.mockResolvedValue(suspendedBar);

      const result = await service.autoUnsuspendIfExpired(mockBar.id!);

      expect(result!.status).toBe('active');
      expect(result!.suspendUntil).toBeNull();
      expect(result!.statusReason).toBeNull();
      expect(barsRepository.save).toHaveBeenCalledWith(suspendedBar);
    });

    it('should not unsuspend when bar is not suspended', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });

      const result = await service.autoUnsuspendIfExpired(mockBar.id!);

      expect(result!.status).toBe('active');
      expect(barsRepository.save).not.toHaveBeenCalled();
    });

    it('should not unsuspend when suspend_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const suspendedBar = {
        ...mockBar,
        status: 'suspended',
        suspendUntil: futureDate,
        statusReason: 'rule violation',
      };
      barsRepository.findOne.mockResolvedValue(suspendedBar);

      const result = await service.autoUnsuspendIfExpired(mockBar.id!);

      expect(result!.status).toBe('suspended');
      expect(result!.suspendUntil).toBe(futureDate);
      expect(barsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Bar',
      description: 'A new bar',
      category: 'tech',
    };
    const userId = '00000000-0000-4000-a000-000000000010';

    it('should create bar with pending_review status and owner membership', async () => {
      barsRepository.findOne.mockResolvedValue(null);

      const result = await service.create(createDto as any, userId);

      expect(result.status).toBe('pending_review');
      expect(result.memberCount).toBe(1);
      expect(result.createdById).toBe(userId);
      expect(mockManager.create).toHaveBeenCalledWith(
        Bar,
        expect.objectContaining({
          name: 'New Bar',
          status: 'pending_review',
          memberCount: 1,
          createdById: userId,
        }),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        BarMember,
        expect.objectContaining({
          userId,
          role: 'owner',
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar name already exists', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, name: 'New Bar' });

      await expect(service.create(createDto as any, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('join', () => {
    const userId = '00000000-0000-4000-a000-000000000020';

    it('should add member and increment memberCount', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue(null);

      const result = await service.join(mockBar.id!, userId);

      expect(result.role).toBe('member');
      expect(result.barId).toBe(mockBar.id);
      expect(result.userId).toBe(userId);
      expect(mockManager.save).toHaveBeenCalled();
      expect(mockManager.increment).toHaveBeenCalledWith(
        Bar,
        { id: mockBar.id },
        'memberCount',
        1,
      );
    });

    it('should throw NotFoundException when bar not found', async () => {
      barsRepository.findOne.mockResolvedValue(null);

      await expect(service.join('non-existent-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already a member', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue(mockMember);

      await expect(service.join(mockBar.id!, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when bar status is permanently_banned', async () => {
      barsRepository.findOne.mockResolvedValue({
        ...mockBar,
        status: 'permanently_banned',
      });

      await expect(service.join(mockBar.id!, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('leave', () => {
    const userId = '00000000-0000-4000-a000-000000000020';

    it('should remove member and decrement memberCount', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, role: 'member' });

      const result = await service.leave(mockBar.id!, userId);

      expect(result).toEqual({ success: true });
      expect(mockManager.remove).toHaveBeenCalled();
      expect(mockManager.decrement).toHaveBeenCalledWith(
        Bar,
        { id: mockBar.id },
        'memberCount',
        1,
      );
    });

    it('should throw ForbiddenException when user is owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, role: 'owner' });

      await expect(service.leave(mockBar.id!, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when not a member', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue(null);

      await expect(service.leave(mockBar.id!, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBar', () => {
    const userId = '00000000-0000-4000-a000-000000000010';

    it('should update bar when user is owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, userId, role: 'owner' });
      barsRepository.save.mockResolvedValue({ ...mockBar, description: 'Updated' });

      const result = await service.updateBar(mockBar.id!, { description: 'Updated' }, userId);

      expect(result.description).toBe('Updated');
      expect(barsRepository.save).toHaveBeenCalled();
    });

    it('should update bar when user is moderator', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, userId, role: 'moderator' });
      barsRepository.save.mockResolvedValue({ ...mockBar, description: 'Updated' });

      const result = await service.updateBar(mockBar.id!, { description: 'Updated' }, userId);

      expect(result.description).toBe('Updated');
    });

    it('should throw ForbiddenException when moderator tries to change category', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, userId, role: 'moderator' });

      await expect(
        service.updateBar(mockBar.id!, { category: 'new-cat' }, userId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is regular member', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, userId, role: 'member' });

      await expect(
        service.updateBar(mockBar.id!, { description: 'Updated' }, userId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when bar not found', async () => {
      barsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateBar('non-existent-id', { description: 'Updated' }, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when bar is permanently_banned', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'permanently_banned' });

      await expect(
        service.updateBar(mockBar.id!, { description: 'Updated' }, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('changeRole', () => {
    const ownerId = '00000000-0000-4000-a000-000000000010';
    const targetUserId = '00000000-0000-4000-a000-000000000020';

    it('should change member role when caller is owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne
        .mockResolvedValueOnce({ ...mockMember, userId: ownerId, role: 'owner' })
        .mockResolvedValueOnce({ ...mockMember, userId: targetUserId, role: 'member' });
      barMembersRepository.save = jest.fn().mockResolvedValue({ ...mockMember, role: 'moderator' });

      const result = await service.changeRole(mockBar.id!, targetUserId, 'moderator', ownerId);

      expect(result.role).toBe('moderator');
    });

    it('should throw ForbiddenException when caller is not owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, role: 'moderator' });

      await expect(
        service.changeRole(mockBar.id!, targetUserId, 'moderator', ownerId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target is not a member', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne
        .mockResolvedValueOnce({ ...mockMember, userId: ownerId, role: 'owner' })
        .mockResolvedValueOnce(null);

      await expect(
        service.changeRole(mockBar.id!, targetUserId, 'moderator', ownerId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when target is owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne
        .mockResolvedValueOnce({ ...mockMember, userId: ownerId, role: 'owner' })
        .mockResolvedValueOnce({ ...mockMember, userId: targetUserId, role: 'owner' });

      await expect(
        service.changeRole(mockBar.id!, targetUserId, 'moderator', ownerId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transferOwnership', () => {
    const ownerId = '00000000-0000-4000-a000-000000000010';
    const targetUserId = '00000000-0000-4000-a000-000000000020';

    it('should transfer ownership from owner to target', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne
        .mockResolvedValueOnce({ ...mockMember, userId: ownerId, role: 'owner' })
        .mockResolvedValueOnce({
          ...mockMember,
          userId: targetUserId,
          role: 'moderator',
          user: { nickname: 'Target User' },
        });

      const result = await service.transferOwnership(mockBar.id!, targetUserId, ownerId);

      expect(result.id).toBe(targetUserId);
      expect(result.role).toBe('owner');
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException when caller is not owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne.mockResolvedValue({ ...mockMember, role: 'moderator' });

      await expect(
        service.transferOwnership(mockBar.id!, targetUserId, ownerId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target is not a member', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne
        .mockResolvedValueOnce({ ...mockMember, userId: ownerId, role: 'owner' })
        .mockResolvedValueOnce(null);

      await expect(
        service.transferOwnership(mockBar.id!, targetUserId, ownerId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when target is already owner', async () => {
      barsRepository.findOne.mockResolvedValue({ ...mockBar, status: 'active' });
      barMembersRepository.findOne
        .mockResolvedValueOnce({ ...mockMember, userId: ownerId, role: 'owner' })
        .mockResolvedValueOnce({ ...mockMember, userId: targetUserId, role: 'owner' });

      await expect(
        service.transferOwnership(mockBar.id!, targetUserId, ownerId),
      ).rejects.toThrow(ConflictException);
    });
  });
});
