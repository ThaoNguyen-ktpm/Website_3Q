import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { env } from '../config/env.js';
import * as users from '../models/userModel.js';
import { verifyGoogleToken } from '../services/googleTokenVerifier.js';
import { createSession, sessionMaxAge } from '../services/authService.js';

vi.mock('../config/env.js', () => ({ env: {
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  SESSION_SECRET: 'test-only-signing-secret-at-least-32-characters',
  GOOGLE_ALLOWED_EMAILS: ['allowed@example.test'],
} }));
vi.mock('../services/googleTokenVerifier.js', () => ({ verifyGoogleToken: vi.fn() }));
vi.mock('../models/userModel.js', () => ({
  findUserByGoogleSub: vi.fn(), findUserByEmail: vi.fn(), findUserById: vi.fn(),
  linkGoogleSub: vi.fn(), createGoogleUser: vi.fn(),
}));

const secret = env.SESSION_SECRET!;
const user = { id: 42, email: 'allowed@example.test', role: 'CUSTOMER' as const, googleSub: 'google-42' };
const publicUser = { id: 42, email: user.email, role: user.role };
const payload = { sub: user.googleSub, email: ' Allowed@Example.Test ', email_verified: true };
function sessionCookie(value = createSession(user.id), signingSecret = secret) {
  const signature = createHmac('sha256', signingSecret).update(value).digest('base64').replace(/=+$/, '');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const login = () => request(app).post('/api/auth/google').send({ credential: 'fixture-token' });

beforeEach(() => {
  vi.resetAllMocks();
  env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  env.SESSION_SECRET = secret;
  env.GOOGLE_ALLOWED_EMAILS = [user.email];
  vi.mocked(verifyGoogleToken).mockResolvedValue(payload as Awaited<ReturnType<typeof verifyGoogleToken>>);
  vi.mocked(users.findUserByGoogleSub).mockResolvedValue(user);
  vi.mocked(users.findUserByEmail).mockResolvedValue(null);
  vi.mocked(users.findUserById).mockResolvedValue(user);
  vi.mocked(users.createGoogleUser).mockResolvedValue(user);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Google login', () => {
  it('returns only the public client ID', async () => {
    const response = await request(app).get('/api/auth/config');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ googleClientId: env.GOOGLE_CLIENT_ID });
  });

  it.each(['GOOGLE_CLIENT_ID', 'SESSION_SECRET'] as const)('fails closed without %s', async (key) => {
    env[key] = undefined;
    for (const response of [await request(app).get('/api/auth/config'), await login()]) {
      expect(response.status).toBe(503);
      expect(response.body.error).toEqual({ code: 'AUTH_NOT_CONFIGURED', message: 'Đăng nhập Google chưa được cấu hình.' });
    }
    expect(verifyGoogleToken).not.toHaveBeenCalled();
  });

  it('verifies audience and returns a signed seven-day httpOnly cookie and safe user', async () => {
    const internalUser = { ...user, passwordHash: 'private-fixture-hash' };
    vi.mocked(users.findUserByGoogleSub).mockResolvedValue(internalUser);
    vi.mocked(users.findUserById).mockResolvedValue(internalUser);
    const response = await login();
    expect(response.status).toBe(200);
    expect(verifyGoogleToken).toHaveBeenCalledWith('fixture-token', env.GOOGLE_CLIENT_ID);
    expect(users.findUserByGoogleSub).toHaveBeenCalledWith(user.googleSub);
    expect(users.findUserByEmail).not.toHaveBeenCalled();
    expect(response.body).toEqual({ user: publicUser });
    const cookie = response.headers['set-cookie'][0];
    for (const attribute of ['sid=s%3A', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=604800']) {
      expect(cookie).toContain(attribute);
    }
    expect(cookie).not.toContain('Secure');
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: publicUser });
    expect(JSON.stringify(response.body)).not.toMatch(/credential|passwordHash|fixture-token/);
    expect(JSON.stringify(response.body)).not.toContain(secret);
  });

  it('sets Secure in production, including when clearing the cookie', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await login();
    expect(response.headers['set-cookie'][0]).toContain('; Secure');
    const loggedOut = await request(app).post('/api/auth/logout');
    expect(loggedOut.headers['set-cookie'][0]).toContain('; Secure');
  });

  it.each([
    { email: 'outsider@example.test', email_verified: true },
    { email: user.email, email_verified: false },
    { email: user.email, email_verified: undefined },
    { email: undefined, email_verified: true },
  ])('denies unapproved/unverified email: %j', async (claims) => {
    vi.mocked(verifyGoogleToken).mockResolvedValue({ ...payload, ...claims } as Awaited<ReturnType<typeof verifyGoogleToken>>);
    const response = await login();
    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({ code: 'EMAIL_NOT_ALLOWED', message: 'Email này không được phép đăng nhập.' });
    expect(users.findUserByGoogleSub).not.toHaveBeenCalled();
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('denies everyone when the allowlist is empty', async () => {
    env.GOOGLE_ALLOWED_EMAILS = [];
    expect((await login()).status).toBe(403);
    expect(users.findUserByGoogleSub).not.toHaveBeenCalled();
  });

  it('maps verifier errors to 401 without exposing token/error details', async () => {
    vi.mocked(verifyGoogleToken).mockRejectedValue(new Error('private fixture-token details'));
    const response = await login();
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
    expect(JSON.stringify(response.body)).not.toContain('fixture-token');
    expect(users.findUserByGoogleSub).not.toHaveBeenCalled();
  });

  it('rejects a missing Google subject', async () => {
    vi.mocked(verifyGoogleToken).mockResolvedValue(undefined);
    expect((await login()).status).toBe(401);
  });

  it.each([{}, { credential: '' }, { credential: 123 }, { credential: 'x'.repeat(4097) },
    { credential: 'fixture-token', role: 'ADMIN' }, null, []])('rejects invalid body before verifying', async (body) => {
    const response = await request(app).post('/api/auth/google')
      .set('Content-Type', 'application/json').send(JSON.stringify(body));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(verifyGoogleToken).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before verifying', async () => {
    const response = await request(app).post('/api/auth/google')
      .set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400);
    expect(verifyGoogleToken).not.toHaveBeenCalled();
  });

  it.each([1, 4096])('accepts credential boundary length %i', async (length) => {
    const response = await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(length) });
    expect(response.status).toBe(200);
  });

  it('links a normalized email to an existing ADMIN without changing role', async () => {
    vi.mocked(users.findUserByGoogleSub).mockResolvedValue(null);
    vi.mocked(users.findUserByEmail).mockResolvedValue({ ...user, googleSub: null, role: 'ADMIN' });
    vi.mocked(users.linkGoogleSub).mockResolvedValue({ ...user, role: 'ADMIN' });
    const response = await login();
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('ADMIN');
    expect(users.findUserByEmail).toHaveBeenCalledWith(user.email);
    expect(users.linkGoogleSub).toHaveBeenCalledWith(user.id, user.googleSub);
    expect(users.createGoogleUser).not.toHaveBeenCalled();
  });

  it('creates a new CUSTOMER', async () => {
    vi.mocked(users.findUserByGoogleSub).mockResolvedValue(null);
    const response = await login();
    expect(response.status).toBe(200);
    expect(users.createGoogleUser).toHaveBeenCalledWith(user.email, user.googleSub);
    expect(response.body.user.role).toBe('CUSTOMER');
    expect(users.linkGoogleSub).not.toHaveBeenCalled();
  });

  it('does not overwrite an email already linked to another subject', async () => {
    vi.mocked(users.findUserByGoogleSub).mockResolvedValue(null);
    vi.mocked(users.findUserByEmail).mockResolvedValue({ ...user, googleSub: 'another-subject' });
    expect((await login()).status).toBe(403);
    expect(users.linkGoogleSub).not.toHaveBeenCalled();
  });

  it('does not expose model/database failures', async () => {
    vi.mocked(users.findUserByGoogleSub).mockRejectedValue(new Error('private database details'));
    const response = await login();
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});

describe('Sessions', () => {
  it('reads a valid signed session', async () => {
    const response = await request(app).get('/api/auth/me').set('Cookie', sessionCookie());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: publicUser });
  });

  it('rejects missing cookies', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    () => sessionCookie(createSession(user.id), 'wrong-signing-secret'),
    () => `sid=${encodeURIComponent(createSession(user.id))}`,
    () => sessionCookie('not-json'),
    () => sessionCookie('null'),
    () => sessionCookie('{}'),
    () => sessionCookie(createSession(-1)),
    () => sessionCookie(createSession(user.id, Date.now() + 60000)),
    () => sessionCookie(createSession(user.id, Date.now() - sessionMaxAge - 1000)),
  ])('rejects invalid, forged, unsigned or expired sessions', async (cookie) => {
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie())).status).toBe(401);
    expect(users.findUserById).not.toHaveBeenCalled();
  });

  it('accepts exactly seven days but rejects one millisecond older', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const atBoundary = sessionCookie(createSession(user.id, Date.now() - sessionMaxAge));
    expect((await request(app).get('/api/auth/me').set('Cookie', atBoundary)).status).toBe(200);
    vi.setSystemTime(Date.now() + 1);
    expect((await request(app).get('/api/auth/me').set('Cookie', atBoundary)).status).toBe(401);
  });

  it('rejects a deleted user', async () => {
    vi.mocked(users.findUserById).mockResolvedValue(null);
    expect((await request(app).get('/api/auth/me').set('Cookie', sessionCookie())).status).toBe(401);
  });

  it('clears the cookie on logout', async () => {
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const cookie = response.headers['set-cookie'][0];
    for (const attribute of ['sid=;', 'Expires=Thu, 01 Jan 1970', 'Path=/', 'HttpOnly', 'SameSite=Lax']) {
      expect(cookie).toContain(attribute);
    }
  });
});
