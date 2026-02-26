import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

/**
 * Comprehensive E2E tests covering the full user journey:
 *   Auth (register / login / me) → Bars (list / detail) →
 *   Posts (create / list / filter / detail) → Replies (create / floor / list)
 *
 * Also covers negative paths: validation errors, auth failures, 404s.
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
  const TEST_BAR_ID = process.env.TEST_BAR_ID ?? '00000000-0000-4000-a000-000000000001';
  const NON_EXISTENT_UUID = '00000000-0000-4000-a000-ffffffffffff';

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

  // ─── Auth flow ────────────────────────────────────────────────────

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

    it('POST /api/auth/register - should reject invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Password123!', nickname: 'Test' })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('POST /api/auth/register - should reject short password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'short@example.com', password: 'Ab1!', nickname: 'Test' })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('POST /api/auth/register - should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'partial@example.com' })
        .expect(400);
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

    it('POST /api/auth/login - should reject non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123!' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/auth/me - should return current user when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.nickname).toBe(testUser.nickname);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('GET /api/auth/me - should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('GET /api/auth/me - should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  // ─── Bars ─────────────────────────────────────────────────────────

  describe('Bars', () => {
    it('GET /api/bars - should return paginated bars', async () => {
      const res = await request(app.getHttpServer()).get('/api/bars').expect(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(typeof res.body.meta.hasMore).toBe('boolean');
    });

    it('GET /api/bars - should respect limit parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bars?limit=1')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('GET /api/bars/:id - should return a single bar', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/bars/${TEST_BAR_ID}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(TEST_BAR_ID);
      expect(res.body.data.name).toBeDefined();
    });

    it('GET /api/bars/:id - should return 404 for non-existent bar', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/bars/${NON_EXISTENT_UUID}`)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Posts flow ───────────────────────────────────────────────────

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
      expect(res.body.data.content).toBe('This is a test post content.');
      expect(res.body.data.contentType).toBe('plaintext');
      createdPostId = res.body.data.id;
    });

    it('POST /api/posts - should return 401 without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/posts')
        .send({
          barId: TEST_BAR_ID,
          title: 'Unauthorized Post',
          content: 'Should fail.',
        })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/posts - should reject missing title', async () => {
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ barId: TEST_BAR_ID, content: 'No title' })
        .expect(400);
    });

    it('POST /api/posts - should reject missing barId', async () => {
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'No Bar', content: 'Missing barId' })
        .expect(400);
    });

    it('POST /api/posts - should reject invalid barId format', async () => {
      await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ barId: 'not-a-uuid', title: 'Bad Bar', content: 'Invalid UUID' })
        .expect(400);
    });

    it('GET /api/posts - should return posts', async () => {
      const res = await request(app.getHttpServer()).get('/api/posts').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/posts - should filter posts by barId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/posts?barId=${TEST_BAR_ID}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].barId || res.body.data[0].bar_id || res.body.data[0].bar?.id)
          .toBeDefined();
      }
    });

    it('GET /api/posts - should respect limit parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/posts?limit=1')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body.meta).toBeDefined();
    });

    it('GET /api/posts/:id - should return a single post', async () => {
      if (!createdPostId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/posts/${createdPostId}`)
        .expect(200);

      expect(res.body.data.id).toBe(createdPostId);
      expect(res.body.data.title).toBe('E2E Test Post');
    });

    it('GET /api/posts/:id - should return 404 for non-existent post', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/posts/${NON_EXISTENT_UUID}`)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Replies flow ─────────────────────────────────────────────────

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

    it('POST /api/posts/:id/replies - should return 401 without authentication', async () => {
      if (!createdPostId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/posts/${createdPostId}/replies`)
        .send({ content: 'Unauthorized reply.' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/posts/:id/replies - should reject empty content', async () => {
      if (!createdPostId) return;

      await request(app.getHttpServer())
        .post(`/api/posts/${createdPostId}/replies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: '' })
        .expect(400);
    });

    it('POST /api/posts/:id/replies - should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .post(`/api/posts/${NON_EXISTENT_UUID}/replies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Reply to nothing.' })
        .expect(404);
    });

    it('GET /api/posts/:id/replies - should return paginated replies', async () => {
      if (!createdPostId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/posts/${createdPostId}/replies`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toBeDefined();
    });

    it('GET /api/posts/:id/replies - should respect limit parameter', async () => {
      if (!createdPostId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/posts/${createdPostId}/replies?limit=1`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.hasMore).toBe(true);
    });
  });

  // ─── Cross-cutting: response envelope ─────────────────────────────

  describe('Response envelope format', () => {
    it('Successful responses should follow { data, meta, error } envelope', async () => {
      const res = await request(app.getHttpServer()).get('/api/bars').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('error', null);
    });

    it('Error responses should follow { data, error } envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/posts/${NON_EXISTENT_UUID}`)
        .expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });
  });
});
