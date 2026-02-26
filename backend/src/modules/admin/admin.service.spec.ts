import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminService } from './admin.service';
import { AdminAction } from './admin-action.entity';
import { Bar } from '../bars/bar.entity';
import { BarsService } from '../bars/bars.service';

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

const adminId = '00000000-0000-4000-a000-000000000099';
const barId = mockBar.id!;

const mockManager = {
  create: jest.fn().mockImplementation((_entity, data) => ({ ...data })),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
};

describe('AdminService', () => {
  let service: AdminService;
  let barsRepository: Record<string, jest.Mock>;
  let adminActionsRepository: Record<string, jest.Mock>;
  let mockBarsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    barsRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      findByIds: jest.fn(),
    };
    adminActionsRepository = {
      createQueryBuilder: jest.fn(),
    };
    mockBarsService = {
      autoUnsuspendIfExpired: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(Bar),
          useValue: barsRepository,
        },
        {
          provide: getRepositoryToken(AdminAction),
          useValue: adminActionsRepository,
        },
        {
          provide: BarsService,
          useValue: mockBarsService,
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

    service = module.get<AdminService>(AdminService);

    jest.clearAllMocks();
  });

  describe('approveBar', () => {
    it('should approve a pending_review bar and create audit log', async () => {
      const pendingBar = { ...mockBar, status: 'pending_review' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(pendingBar);

      const result = await service.approveBar(barId, adminId);

      expect(result).toEqual({ success: true });
      expect(pendingBar.status).toBe('active');
      expect(pendingBar.reviewedById).toBe(adminId);
      expect(pendingBar.reviewedAt).toBeInstanceOf(Date);
      expect(mockManager.save).toHaveBeenCalledWith(pendingBar);
      expect(mockManager.create).toHaveBeenCalledWith(
        AdminAction,
        expect.objectContaining({
          adminId,
          action: 'approve',
          targetType: 'bar',
          targetId: barId,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar is not pending_review', async () => {
      const activeBar = { ...mockBar, status: 'active' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(activeBar);

      await expect(service.approveBar(barId, adminId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when bar not found', async () => {
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(null);

      await expect(service.approveBar(barId, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectBar', () => {
    const reason = 'Violates community guidelines';

    it('should reject a pending_review bar with reason and create audit log', async () => {
      const pendingBar = { ...mockBar, status: 'pending_review' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(pendingBar);

      const result = await service.rejectBar(barId, adminId, reason);

      expect(result).toEqual({ success: true });
      expect(pendingBar.status).toBe('rejected');
      expect(pendingBar.statusReason).toBe(reason);
      expect(pendingBar.reviewedById).toBe(adminId);
      expect(pendingBar.reviewedAt).toBeInstanceOf(Date);
      expect(mockManager.save).toHaveBeenCalledWith(pendingBar);
      expect(mockManager.create).toHaveBeenCalledWith(
        AdminAction,
        expect.objectContaining({
          adminId,
          action: 'reject',
          targetType: 'bar',
          targetId: barId,
          reason,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar is not pending_review', async () => {
      const activeBar = { ...mockBar, status: 'active' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(activeBar);

      await expect(
        service.rejectBar(barId, adminId, reason),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('suspendBar', () => {
    const reason = 'Repeated rule violations';
    const duration = 24;

    it('should suspend an active bar with reason and duration', async () => {
      const activeBar = { ...mockBar, status: 'active' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(activeBar);

      const result = await service.suspendBar(barId, adminId, reason, duration);

      expect(result).toEqual({ success: true });
      expect(activeBar.status).toBe('suspended');
      expect(activeBar.statusReason).toBe(reason);
      expect(activeBar.suspendUntil).toBeInstanceOf(Date);
      expect(mockManager.save).toHaveBeenCalledWith(activeBar);
      expect(mockManager.create).toHaveBeenCalledWith(
        AdminAction,
        expect.objectContaining({
          adminId,
          action: 'suspend',
          targetType: 'bar',
          targetId: barId,
          reason,
          metadata: expect.objectContaining({ duration }),
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar is in a non-suspendable state', async () => {
      const closedBar = { ...mockBar, status: 'closed' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(closedBar);

      await expect(
        service.suspendBar(barId, adminId, reason, duration),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('unsuspendBar', () => {
    it('should unsuspend a suspended bar', async () => {
      const suspendedBar = {
        ...mockBar,
        status: 'suspended' as const,
        statusReason: 'rule violation',
        suspendUntil: new Date(Date.now() + 86400000),
      };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(suspendedBar);

      const result = await service.unsuspendBar(barId, adminId);

      expect(result).toEqual({ success: true });
      expect(suspendedBar.status).toBe('active');
      expect(suspendedBar.statusReason).toBeNull();
      expect(suspendedBar.suspendUntil).toBeNull();
      expect(mockManager.save).toHaveBeenCalledWith(suspendedBar);
      expect(mockManager.create).toHaveBeenCalledWith(
        AdminAction,
        expect.objectContaining({
          adminId,
          action: 'unsuspend',
          targetType: 'bar',
          targetId: barId,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar is not suspended', async () => {
      const activeBar = { ...mockBar, status: 'active' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(activeBar);

      await expect(service.unsuspendBar(barId, adminId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('banBar', () => {
    const reason = 'Severe policy violation';

    it('should permanently ban an active bar', async () => {
      const activeBar = { ...mockBar, status: 'active' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(activeBar);

      const result = await service.banBar(barId, adminId, reason);

      expect(result).toEqual({ success: true });
      expect(activeBar.status).toBe('permanently_banned');
      expect(activeBar.statusReason).toBe(reason);
      expect(activeBar.suspendUntil).toBeNull();
      expect(mockManager.save).toHaveBeenCalledWith(activeBar);
      expect(mockManager.create).toHaveBeenCalledWith(
        AdminAction,
        expect.objectContaining({
          adminId,
          action: 'ban',
          targetType: 'bar',
          targetId: barId,
          reason,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar is in a terminal state', async () => {
      const closedBar = { ...mockBar, status: 'closed' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(closedBar);

      await expect(
        service.banBar(barId, adminId, reason),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('closeBar', () => {
    const reason = 'Administrative closure';

    it('should close an active bar', async () => {
      const activeBar = { ...mockBar, status: 'active' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(activeBar);

      const result = await service.closeBar(barId, adminId, reason);

      expect(result).toEqual({ success: true });
      expect(activeBar.status).toBe('closed');
      expect(activeBar.statusReason).toBe(reason);
      expect(activeBar.suspendUntil).toBeNull();
      expect(mockManager.save).toHaveBeenCalledWith(activeBar);
      expect(mockManager.create).toHaveBeenCalledWith(
        AdminAction,
        expect.objectContaining({
          adminId,
          action: 'close',
          targetType: 'bar',
          targetId: barId,
          reason,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when bar is in a terminal state', async () => {
      const closedBar = { ...mockBar, status: 'closed' as const };
      mockBarsService.autoUnsuspendIfExpired.mockResolvedValue(closedBar);

      await expect(
        service.closeBar(barId, adminId, reason),
      ).rejects.toThrow(ConflictException);
    });
  });
});
