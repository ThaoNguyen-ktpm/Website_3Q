import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { findProducts } from '../models/productModel.js';
import { env } from '../config/env.js';
import { createSession, sessionMaxAge } from '../services/authService.js';

vi.mock('../models/productModel.js', () => ({ findProducts: vi.fn() }));
vi.mock('../config/env.js', () => ({ env: {
  SESSION_SECRET: 'test-only-products-signing-secret-32-characters',
  GOOGLE_ALLOWED_EMAILS: ['fixture@example.test'],
} }));

const secret = env.SESSION_SECRET!;
const user = { id: 1, email: 'fixture@example.test', fullName: 'Mẫu', role: 'STAFF', status: 'ACTIVE' };
vi.mock('../models/rolePermissionModel.js', () => ({ list: vi.fn(async () => []), replace: vi.fn() }));
vi.mock('../models/staffModel.js', () => ({findById: vi.fn()}));
import { findById } from '../models/staffModel.js';
function sessionCookie(value = createSession(user.id), signingSecret = secret) {
  const signature = createHmac('sha256', signingSecret).update(value).digest('base64').replace(/=+$/, '');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(findById).mockResolvedValue(user as Awaited<ReturnType<typeof findById>>);
    env.SESSION_SECRET = secret;
    env.GOOGLE_ALLOWED_EMAILS = [user.email];
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    () => undefined,
    () => sessionCookie(createSession(user.id), 'wrong-secret'),
    () => `sid=${encodeURIComponent(createSession(user.id))}`,
    () => sessionCookie(createSession(user.id, Date.now() - sessionMaxAge - 1000)),
  ])('chặn cookie thiếu, giả, không ký hoặc hết hạn trước khi gọi model', async (cookie) => {
    const call = request(app).get('/api/products');
    const value = cookie();
    if (value) call.set('Cookie', value);
    const response = await call;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Bạn chưa đăng nhập.' } });
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('chặn mặc định khi thiếu SESSION_SECRET dù cookie ký hợp lệ', async () => {
    env.SESSION_SECRET = undefined;
    const response = await request(app).get('/api/products').set('Cookie', sessionCookie());
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('chặn phiên nhân viên đã bị tạm ngưng', async () => {
    vi.mocked(findById).mockResolvedValue({...user,status:'DISABLED'} as Awaited<ReturnType<typeof findById>>);
    const response = await request(app).get('/api/products').set('Cookie', sessionCookie());
    expect(response.status).toBe(401);
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('chấp nhận đúng 7 ngày và chặn phiên cũ hơn 1ms', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    vi.mocked(findProducts).mockResolvedValue([]);
    const cookie = sessionCookie(createSession(user.id, Date.now() - sessionMaxAge));
    expect((await request(app).get('/api/products').set('Cookie', cookie)).status).toBe(200);
    vi.mocked(findProducts).mockClear();
    vi.setSystemTime(Date.now() + 1);
    expect((await request(app).get('/api/products').set('Cookie', cookie)).status).toBe(401);
    expect(findProducts).not.toHaveBeenCalled();
  });

  it('trả tên, giá VND và danh mục có dấu tiếng Việt', async () => {
    vi.mocked(findProducts).mockResolvedValue([
      { id: 1, name: 'Túi tote vải mẫu', priceVnd: 185000, category: { name: 'Túi xách' } },
    ]);

    const response = await request(app).get('/api/products').set('Cookie', sessionCookie());
    expect(response.status).toBe(200);
    expect(findProducts).toHaveBeenCalledOnce();
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      products: [{ id: 1, name: 'Túi tote vải mẫu', priceVnd: 185000, category: 'Túi xách' }],
    });
  });

});
