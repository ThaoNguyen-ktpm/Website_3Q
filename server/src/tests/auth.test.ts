import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { verifyGoogleToken } from '../services/googleTokenVerifier.js';
import { createSession, sessionMaxAge } from '../services/authService.js';

vi.mock('../config/env.js', () => ({ env: {
  APP_ORIGIN: 'http://localhost:5173',
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  SESSION_SECRET: 'test-only-signing-secret-at-least-32-characters',
  GOOGLE_ALLOWED_EMAILS: ['allowed@example.test'],
} }));
vi.mock('../services/googleTokenVerifier.js', () => ({ verifyGoogleToken: vi.fn() }));
vi.mock('../models/rolePermissionModel.js', () => ({ list: vi.fn(async () => []) }));
vi.mock('../models/staffModel.js', () => ({
  findByEmail: vi.fn(), findById: vi.fn(), findByGoogleSub: vi.fn(), update: vi.fn(),
  transaction: vi.fn(action => action({})),
}));
import * as staffModel from '../models/staffModel.js';
import * as permissionModel from '../models/rolePermissionModel.js';
import { rolePermissions } from '../config/permissions.js';
import * as auditModel from '../models/auditLogModel.js';
vi.mock('../models/auditLogModel.js', () => ({ create: vi.fn(async () => ({})), list: vi.fn(), deleteBefore: vi.fn() }));

const secret = env.SESSION_SECRET!;
const user = { customPermissions:false, permissions:[] as {permission:string}[], id: 1, email: 'allowed@example.test', fullName: 'Chủ mẫu', role: 'ADMIN' as const, status: 'ACTIVE' as const, googleSub: null, phone: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() };
// TASK-024: /api/auth/google và /api/auth/me trả thêm isPrimaryAdmin (user mẫu không phải Admin chính); vẫn so khớp tuyệt đối.
const publicUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, roleLabel: 'Admin', permissions: rolePermissions.ADMIN, isPrimaryAdmin: false };
const payload = { sub: 'google-42', email: ' Allowed@Example.Test ', email_verified: true };
function sessionCookie(value = createSession(user.id), signingSecret = secret) {
  const signature = createHmac('sha256', signingSecret).update(value).digest('base64').replace(/=+$/, '');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const login = () => request(app).post('/api/auth/google').set('Origin', 'http://localhost:5173').send({ credential: 'fixture-token' });

it('returns per-staff permissions after Google login and on /me', async () => {
  const custom = { ...user, role: 'STAFF' as const, customPermissions: true, permissions: [{ permission: 'products.view' }] };
  vi.mocked(staffModel.findById).mockResolvedValue(custom);
  vi.mocked(staffModel.update).mockResolvedValue(custom);
  const response = await login();
  expect(response.status).toBe(200);
  expect(response.body.user.permissions).toEqual(['products.view']);
  const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie());
  expect(me.body.user.permissions).toEqual(['products.view']);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(permissionModel.list).mockResolvedValue([]);
  vi.mocked(staffModel.findByEmail).mockImplementation(async email => email === user.email ? {...user} : null);
  vi.mocked(staffModel.findById).mockImplementation(async id => id === user.id ? {...user} : null);
  vi.mocked(staffModel.findByGoogleSub).mockResolvedValue(null);
  vi.mocked(staffModel.update).mockResolvedValue({...user});
  env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  env.SESSION_SECRET = secret;
  env.GOOGLE_ALLOWED_EMAILS = [user.email];
  vi.mocked(verifyGoogleToken).mockResolvedValue(payload as Awaited<ReturnType<typeof verifyGoogleToken>>);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Google login', () => {
  it('records successful login with actor and IP, without token or Google subject', async () => {
    expect((await login()).status).toBe(200);
    expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login', actorId: user.id, actorEmail: user.email, ip: expect.any(String) }));
    expect(JSON.stringify(vi.mocked(auditModel.create).mock.calls)).not.toMatch(/fixture-token|google-42|googleSub|cookie/i);
  });
  it.each([
    ['not_staff', null], ['disabled', {...user,status:'DISABLED'}], ['sub_mismatch', {...user,googleSub:'other-sub'}],
  ])('records denial reason %s', async (reason, staff) => {
    vi.mocked(staffModel.findByEmail).mockResolvedValue(staff as typeof user);
    expect((await login()).status).toBe(403);
    expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_denied', actorEmail: user.email, after: { reason } }));
    expect(JSON.stringify(vi.mocked(auditModel.create).mock.calls)).not.toMatch(/fixture-token|google-42|other-sub/);
  });
  it('records unverified email without looking up staff', async () => {
    vi.mocked(verifyGoogleToken).mockResolvedValue({...payload,email_verified:false});
    expect((await login()).status).toBe(403);
    expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_denied', after: { reason: 'unverified_email' } }));
    expect(staffModel.findByEmail).not.toHaveBeenCalled();
  });
  it.each([
    ['not_staff', null], ['disabled', {...user,status:'DISABLED'}], ['sub_mismatch', {...user,googleSub:'other-sub'}],
  ])('records a staff change detected inside the login transaction: %s', async (reason, current) => {
    vi.mocked(staffModel.findById).mockResolvedValue(current as typeof user);
    expect((await login()).status).toBe(403);
    expect(auditModel.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({action:'auth.login_denied',after:{reason}}));
    expect(staffModel.update).not.toHaveBeenCalled();
  });
  it('records a Google subject collision as a mismatch', async () => {
    vi.mocked(staffModel.findByGoogleSub).mockResolvedValue({...user,id:2});
    expect((await login()).status).toBe(403);
    expect(auditModel.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({action:'auth.login_denied',after:{reason:'sub_mismatch'}}));
  });
  it('records a unique-subject race as a mismatch without a successful login log', async () => {
    vi.mocked(staffModel.update).mockRejectedValueOnce({code:'P2002'});
    expect((await login()).status).toBe(403);
    expect(auditModel.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({action:'auth.login_denied',after:{reason:'sub_mismatch'}}));
  });
  it('keeps a denied login denied even when recording it fails', async () => {
    const error=vi.spyOn(console,'error').mockImplementation(()=>{});
    vi.mocked(staffModel.findByEmail).mockResolvedValue(null);
    vi.mocked(auditModel.create).mockRejectedValueOnce(new Error('private failure'));
    expect((await login()).status).toBe(403);
    expect(error).toHaveBeenCalledExactlyOnceWith('Không thể ghi nhật ký thao tác.');
    error.mockRestore();
  });
  it('keeps login/logout successful if the audit write fails and logs no error payload', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auditModel.create).mockRejectedValueOnce(new Error('secret-token'));
    expect((await login()).status).toBe(200);
    vi.mocked(auditModel.create).mockRejectedValueOnce(new Error('secret-token'));
    expect((await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173').set('Cookie',sessionCookie())).status).toBe(204);
    expect(error.mock.calls).toEqual([['Không thể ghi nhật ký thao tác.'],['Không thể ghi nhật ký thao tác.']]);
    error.mockRestore();
  });
  it('records logout only for an identified session', async () => {
    await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173').set('Cookie',sessionCookie());
    expect(auditModel.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.logout', actorId: user.id, actorEmail: user.email }));
    vi.mocked(auditModel.create).mockClear();
    await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173');
    expect(auditModel.create).not.toHaveBeenCalled();
  });
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
    const response = await login();
    expect(response.status).toBe(200);
    expect(verifyGoogleToken).toHaveBeenCalledWith('fixture-token', env.GOOGLE_CLIENT_ID);
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
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toMatch(/^__Host-sid=/);
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain=');
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0])).status).toBe(200);
    expect((await request(app).get('/api/staff/roles').set('Cookie', cookie.split(';')[0])).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', sessionCookie())).status).toBe(401);
    const loggedOut = await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173');
    expect(loggedOut.headers['set-cookie'][0]).toContain('; Secure');
    expect(loggedOut.headers['set-cookie'][0]).toMatch(/^__Host-sid=;/);
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
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('uses Staff instead of the seed allowlist', async () => {
    env.GOOGLE_ALLOWED_EMAILS = [];
    expect((await login()).status).toBe(200);
  });

  it('maps verifier errors to 401 without exposing token/error details', async () => {
    vi.mocked(verifyGoogleToken).mockRejectedValue(new Error('private fixture-token details'));
    const response = await login();
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
    expect(JSON.stringify(response.body)).not.toContain('fixture-token');
  });

  it('rejects a missing Google subject', async () => {
    vi.mocked(verifyGoogleToken).mockResolvedValue(undefined);
    expect((await login()).status).toBe(401);
  });

  it.each([{}, { credential: '' }, { credential: 123 }, { credential: 'x'.repeat(4097) },
    { credential: 'fixture-token', role: 'ADMIN' }, null, []])('rejects invalid body before verifying', async (body) => {
    const response = await request(app).post('/api/auth/google').set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json').send(JSON.stringify(body));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(verifyGoogleToken).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before verifying', async () => {
    const response = await request(app).post('/api/auth/google').set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400);
    expect(verifyGoogleToken).not.toHaveBeenCalled();
  });

  it.each([1, 4096])('accepts credential boundary length %i', async (length) => {
    const response = await request(app).post('/api/auth/google').set('Origin', 'http://localhost:5173').send({ credential: 'x'.repeat(length) });
    expect(response.status).toBe(200);
  });

  it('binds Google subject and updates last login through the staff model', async () => {
    const response = await login();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: publicUser });
    expect(staffModel.update).toHaveBeenCalledWith(user.id, {googleSub: payload.sub, lastLoginAt: expect.any(Date)}, {});
  });

  it.each([{...user,status:'DISABLED'}, null, {...user,googleSub:'another-sub'}])('denies inactive, missing or mismatched staff', async staff => {
    vi.mocked(staffModel.findByEmail).mockResolvedValue(staff as typeof user);
    expect((await login()).status).toBe(403);
  });
  it('denies a Google subject already bound to another staff', async () => {
    vi.mocked(staffModel.findByGoogleSub).mockResolvedValue({...user,id:2});
    expect((await login()).status).toBe(403);
  });

});

describe('Sessions', () => {
  it('uses database permissions in Google login and refreshes them with the same cookie', async () => {
    const staff = {...user,role:'STAFF' as const};
    vi.mocked(staffModel.findByEmail).mockResolvedValue(staff);
    vi.mocked(staffModel.findById).mockResolvedValue(staff);
    vi.mocked(staffModel.update).mockResolvedValue(staff);
    vi.mocked(permissionModel.list).mockResolvedValue([{permission:'products.view'}]);
    const response = await login();
    expect(response.status).toBe(200);
    expect(response.body.user.permissions).toEqual(['products.view']);
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    vi.mocked(permissionModel.list).mockResolvedValue([{permission:'orders.view'}]);
    const me = await request(app).get('/api/auth/me').set('Cookie',cookie);
    expect(me.body.user.permissions).toEqual(['orders.view']);
  });
  it('stores only staffId and creation time', () => {
    expect(JSON.parse(createSession(user.id, 123))).toEqual({ staffId: user.id, createdAt: 123 });
  });

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
    () => sessionCookie(JSON.stringify({ email: 42, createdAt: Date.now() })),
    () => sessionCookie(JSON.stringify({ userId: 42, createdAt: Date.now() })),
    () => sessionCookie(JSON.stringify({ email: user.email, createdAt: 'invalid' })),
    () => sessionCookie(createSession(99)),
    () => sessionCookie(createSession(user.id, Date.now() + 60000)),
    () => sessionCookie(createSession(user.id, Date.now() - sessionMaxAge - 1000)),
  ])('rejects invalid, forged, unsigned or expired sessions', async (cookie) => {
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie())).status).toBe(401);
  });

  it('accepts exactly seven days but rejects one millisecond older', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const atBoundary = sessionCookie(createSession(user.id, Date.now() - sessionMaxAge));
    expect((await request(app).get('/api/auth/me').set('Cookie', atBoundary)).status).toBe(200);
    vi.setSystemTime(Date.now() + 1);
    expect((await request(app).get('/api/auth/me').set('Cookie', atBoundary)).status).toBe(401);
  });

  it('revokes a session immediately when staff is disabled', async () => {
    const cookie = sessionCookie();
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    vi.mocked(staffModel.findById).mockResolvedValue({...user,status:'DISABLED'});
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('uses the current role from Staff, not a role stored in the cookie', async () => {
    const cookie = sessionCookie();
    vi.mocked(staffModel.findById).mockResolvedValue({...user,role:'STAFF'});
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(response.body.user.permissions).toEqual(rolePermissions.STAFF);
  });

  it('clears the cookie on logout', async () => {
    const response = await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173');
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const cookie = response.headers['set-cookie'][0];
    for (const attribute of ['sid=;', 'Expires=Thu, 01 Jan 1970', 'Path=/', 'HttpOnly', 'SameSite=Lax']) {
      expect(cookie).toContain(attribute);
    }
  });
});
