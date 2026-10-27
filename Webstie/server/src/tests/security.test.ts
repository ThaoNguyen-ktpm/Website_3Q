import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLimiter } from '../middlewares/rateLimit.js';

afterEach(() => vi.unstubAllEnvs());

async function loadApp(mode = 'test', proxy?: string) {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', mode);
  vi.stubEnv('APP_ORIGIN', 'https://shop.example.test');
  vi.stubEnv('TRUST_PROXY', proxy);
  return (await import('../app.js')).app;
}

describe('HTTP protection', () => {
  it.each(['test', 'production'])('sets API headers in %s', async mode => {
    const app = await loadApp(mode);
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none'");
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['strict-transport-security']).toBe(mode === 'production'
      ? 'max-age=15552000; includeSubDomains' : undefined);
    expect(response.headers['access-control-allow-origin']).toBe('https://shop.example.test');
  });

  it('enables trust proxy only with configured hop count', async () => {
    expect((await loadApp()).get('trust proxy')).toBe(false);
    expect((await loadApp('test', '1')).get('trust proxy')).toBe(1);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects foreign and missing origins for %s', async method => {
    const app = await loadApp();
    for (const origin of [undefined, 'null', 'https://evil.test', 'https://shop.example.test.evil.test']) {
      let req = request(app)[method.toLowerCase() as 'post']('/api/staff');
      if (origin !== undefined) req = req.set('Origin', origin);
      const response = await req;
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: { code: 'BAD_ORIGIN', message: 'Yêu cầu không hợp lệ.' } });
    }
  });

  it('accepts exact Origin or Referer fallback and gives Origin precedence', async () => {
    const app = await loadApp();
    for (const headers of [
      { Origin: 'https://shop.example.test' },
      { Referer: 'https://shop.example.test/admin' },
    ]) {
      expect((await request(app).post('/api/staff').set(headers)).status).toBe(401);
    }
    for (const headers of [
      { Referer: 'https://shop.example.test.evil.test/admin' },
      { Origin: 'https://evil.test', Referer: 'https://shop.example.test/admin' },
    ]) {
      expect((await request(app).post('/api/staff').set(headers)).status).toBe(403);
    }
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).head('/api/health')).status).toBe(200);
    expect((await request(app).options('/api/staff')).status).toBe(204);
  });

  it('limits the actual auth route at request 11 outside test mode', async () => {
    const app = await loadApp('development');
    for (let i = 0; i < 10; i++) {
      const response = await request(app).post('/api/auth/google').set('Origin', 'https://shop.example.test').send({});
      expect(response.status).not.toBe(429);
    }
    const response = await request(app).post('/api/auth/google').set('Origin', 'https://shop.example.test').send({});
    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' } });
    expect(response.headers['ratelimit-limit']).toBe('10');
    expect(response.headers['ratelimit-remaining']).toBe('0');
    expect(response.headers['ratelimit-reset']).toBeDefined();
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('limits the entire API at request 301 and skips in test mode', async () => {
    const app = await loadApp('development');
    for (let i = 0; i < 300; i++) expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/health')).status).toBe(429);
    const testApp = await loadApp();
    for (let i = 0; i < 11; i++) {
      expect((await request(testApp).post('/api/auth/google').set('Origin', 'https://shop.example.test')).status).not.toBe(429);
    }
  });

  it('can enforce a fresh limiter in test mode', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const app = express().use(createLimiter(1, true)).get('/', (_req, res) => { res.sendStatus(200); });
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(429);
  });
});
