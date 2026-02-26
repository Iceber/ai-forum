import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const mockUser = {
  id: 'uuid-1',
  email: 'test@example.com',
  passwordHash: 'hashed_pw',
  nickname: 'Test User',
  role: 'user',
  tokenVersion: 0,
  emailVerified: false,
  authProvider: 'local',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock.jwt.token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should create a new user and return access token', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        nickname: 'Test User',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(usersService.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already in use', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          nickname: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return access token on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as any);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException on unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@example.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('correct_password', 10);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as any);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong_pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sanitizeUser', () => {
    it('should strip passwordHash from user object', () => {
      const sanitized = service.sanitizeUser(mockUser as any);
      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized).toHaveProperty('email', 'test@example.com');
    });
  });
});
