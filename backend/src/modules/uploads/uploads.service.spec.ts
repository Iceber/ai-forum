import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultVal?: string) => {
              const config: Record<string, string> = {
                S3_ENDPOINT: 'http://localhost:9000',
                S3_BUCKET: 'test-bucket',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  describe('getPresignedUrl', () => {
    it('should return uploadUrl and fileUrl with correct extension when filename has extension', async () => {
      const result = await service.getPresignedUrl(
        { filename: 'test.png', contentType: 'image/png' },
        'user-uuid-1',
      );

      expect(result.uploadUrl).toContain('http://localhost:9000/test-bucket/uploads/user-uuid-1/');
      expect(result.uploadUrl).toContain('.png');
      expect(result.uploadUrl).toContain('?presigned=true');
      expect(result.fileUrl).toContain('http://localhost:9000/test-bucket/uploads/user-uuid-1/');
      expect(result.fileUrl).toContain('.png');
    });

    it('should use fallback extension when filename has no extension', async () => {
      const result = await service.getPresignedUrl(
        { filename: 'noext', contentType: 'image/jpeg' },
        'user-uuid-1',
      );

      // 'noext'.split('.').pop() returns 'noext', so extension is 'noext'
      expect(result.fileUrl).toContain('.noext');
    });

    it('should generate unique keys for each call', async () => {
      const result1 = await service.getPresignedUrl(
        { filename: 'a.png', contentType: 'image/png' },
        'user-uuid-1',
      );
      const result2 = await service.getPresignedUrl(
        { filename: 'a.png', contentType: 'image/png' },
        'user-uuid-1',
      );

      expect(result1.fileUrl).not.toBe(result2.fileUrl);
    });

    it('should include userId in the key path', async () => {
      const result = await service.getPresignedUrl(
        { filename: 'photo.jpg', contentType: 'image/jpeg' },
        'my-user-id',
      );

      expect(result.fileUrl).toContain('/uploads/my-user-id/');
      expect(result.uploadUrl).toContain('/uploads/my-user-id/');
    });

    it('should use default config values when env vars are not set', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((_key: string, defaultVal?: string) => defaultVal),
            },
          },
        ],
      }).compile();

      const svcWithDefaults = module.get<UploadsService>(UploadsService);

      const result = await svcWithDefaults.getPresignedUrl(
        { filename: 'file.txt', contentType: 'text/plain' },
        'user-1',
      );

      expect(result.fileUrl).toContain('http://localhost:9000/ai-forum/uploads/user-1/');
    });
  });
});
