import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

/**
 * E2E test: register -> login -> create post -> create reply
 *
 * Prerequisites:
 *   - A running PostgreSQL instance with the schema from migrations/001_initial_schema.sql applied
 *   - A bar with a known ID already seeded in the database
 *   - Environment variables set (DB_*, JWT_SECRET)
 *
 * Run with: npm run test:e2e
 */
describe('AppController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let createdPostId: string;

  // Provide a real bar ID from your seed data or create one before running
  const TEST_BAR_ID = process.env.TEST_BAR_ID ?? '00000000-0000-0000-0000-000000000001';

  const testUser = {
    email: `e2e_${Date.now()}@example.com`,
    password: 'Password123!',
    nickname: 'E2ETestUser',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth flow', () => {
    it('POST /api/auth/register - should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.error).toBeNull();

      accessToken = res.body.data.accessToken;
    });

    it('POST /api/auth/register - should reject duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('POST /api/auth/login - should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      accessToken = res.body.data.accessToken;
    });

    it('POST /api/auth/login - should reject wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/auth/me - should return current user when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('GET /api/auth/me - should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

  describe('Bars', () => {
    it('GET /api/bars - should return paginated bars', async () => {
      const res = await request(app.getHttpServer()).get('/api/bars').expect(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(typeof res.body.meta.hasMore).toBe('boolean');
    });
  });

  describe('Posts flow', () => {
    it('POST /api/posts - should create a post when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          barId: TEST_BAR_ID,
          title: 'E2E Test Post',
          content: 'This is a test post content.',
          contentType: 'plaintext',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('E2E Test Post');
      createdPostId = res.body.data.id;
    });

    it('GET /api/posts - should return posts', async () => {
      const res = await request(app.getHttpServer()).get('/api/posts').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/posts/:id - should return a single post', async () => {
      if (!createdPostId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/posts/${createdPostId}`)
        .expect(200);
      expect(res.body.data.id).toBe(createdPostId);
    });
  });

  describe('Replies flow', () => {
    it('POST /api/posts/:id/replies - should create a reply', async () => {
      if (!createdPostId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${createdPostId}/replies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'This is a test reply.', contentType: 'plaintext' })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.floorNumber).toBe(1);
      expect(res.body.data.content).toBe('This is a test reply.');
    });

    it('POST /api/posts/:id/replies - should increment floor number', async () => {
      if (!createdPostId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${createdPostId}/replies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Second reply.' })
        .expect(201);

      expect(res.body.data.floorNumber).toBe(2);
    });

    it('GET /api/posts/:id/replies - should return paginated replies', async () => {
      if (!createdPostId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/posts/${createdPostId}/replies`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });
  });
});
