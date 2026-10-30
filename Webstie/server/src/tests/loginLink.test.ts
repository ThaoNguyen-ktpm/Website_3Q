import { createHmac } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { createSession } from '../services/authService.js';
import { consumeLink, createLink, lanOrigin } from '../services/loginLinkService.js';
import { allowedOrigin } from '../config/origins.js';

// Bảo 2026-10-20: MacBooks on the shop wifi open the site by IP and sign in with a one-time link from the Nhân viên page.
vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:8787', EXTRA_ORIGINS: ['https://ops.example.test'], SESSION_SECRET: 'test-only-signing-secret-at-least-32-characters' } }));
vi.mock('../models/rolePermissionModel.js', () => ({ list: vi.fn(async () => []) }));
vi.mock('../models/staffModel.js', () => ({ findByEmail: vi.fn(), findById: vi.fn(), findByGoogleSub: vi.fn(), update: vi.fn(), transaction: vi.fn(action => action({})) }));
vi.mock('../models/auditLogModel.js', () => ({ create: vi.fn(async () => ({})), list: vi.fn(), deleteBefore: vi.fn() }));
import * as staffModel from '../models/staffModel.js';
import * as auditModel from '../models/auditLogModel.js';

const base = { customPermissions: false, permissions: [] as { permission: string }[], googleSub: null, phone: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() };
const people = {
  1: { ...base, id: 1, email: 'admin@example.test', fullName: 'Admin', role: 'ADMIN' as const, status: 'ACTIVE' as const },
  2: { ...base, id: 2, email: 'mac@example.test', fullName: 'Nhân viên Mac', role: 'STAFF' as const, status: 'ACTIVE' as const },
};
const cookie = (id: number) => {
  const value = createSession(id);
  const signature = createHmac('sha256', 'test-only-signing-secret-at-least-32-characters').update(value).digest('base64').replace(/=+$/, '');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
};
const lan = 'http://192.168.1.20:8787';
beforeEach(() => {
  vi.mocked(staffModel.findById).mockImplementation(async (id: number) => people[id as 1 | 2] ?? null);
  vi.mocked(staffModel.update).mockImplementation(async (id: number) => people[id as 1 | 2]);
});

it('a link works once and only within 10 minutes', () => {
  const { code } = createLink(2, 0);
  expect(consumeLink(code, 1000)).toBe(2);
  expect(consumeLink(code, 1000)).toBeNull();
  expect(consumeLink(createLink(2, 0).code, 10 * 60 * 1000)).toBeNull();
});

it('the link address is the wifi IP with the site port, 192.168 before other private ranges', () => {
  const nic = (address: string, internal = false) => ({ address, family: 'IPv4', internal, netmask: '', mac: '', cidr: null }) as const;
  expect(lanOrigin('http://localhost:8787', { vEthernet: [nic('172.20.0.1')], wifi: [nic('192.168.110.213')], lo: [nic('127.0.0.1', true)] }))
    .toBe('http://192.168.110.213:8787');
  expect(lanOrigin('http://localhost:8787', {})).toBe('http://localhost:8787');
});

it('only the site itself or the same port on a private IP passes the origin check', () => {
  expect(['http://localhost:8787', lan, 'http://10.0.0.5:8787', 'http://172.16.4.2:8787', 'https://ops.example.test', 'https://192.168.1.20'].map(allowedOrigin))
    .toEqual([true, true, true, true, true, true]);
  expect(['http://8.8.8.8:8787', 'http://192.168.1.20:4000', 'https://192.168.1.20:8787', 'http://192.168.1.20.evil.test:8787', undefined].map(allowedOrigin))
    .toEqual([false, false, false, false, false]);
});

it('a manager makes a link, the Mac signs in once by IP, and the code is never written to the audit log', async () => {
  const webstie = await request(app).post('/api/staff/2/login-link').set('Origin', 'http://localhost:8787').set('Cookie', cookie(1));
  expect(new URL(webstie.body.url).port).toBe('8787');
  const made = await request(app).post('/api/staff/2/login-link').set('Origin', 'http://localhost:8787').set('Cookie', cookie(1));
  expect(made.status).toBe(200);
  const url = new URL(made.body.url);
  expect(url.port).toBe('8787');
  expect(url.pathname).toBe('/dang-nhap');
  const code = url.searchParams.get('ma')!;
  const first = await request(app).post('/api/auth/link').set('Origin', lan).send({ code });
  expect([first.status, first.body.user.email]).toEqual([200, 'mac@example.test']);
  expect(first.headers['set-cookie']?.[0]).toMatch(/^sid=/);
  const again = await request(app).post('/api/auth/link').set('Origin', lan).send({ code });
  expect([again.status, again.body.error.code]).toEqual([401, 'INVALID_LOGIN_LINK']);
  expect(JSON.stringify(vi.mocked(auditModel.create).mock.calls)).not.toContain(code);
});

it('a fresh link can sign in through the 8787 wifi origin', async () => {
  const made = await request(app).post('/api/staff/2/login-link').set('Origin', 'http://192.168.1.20:8787').set('Cookie', cookie(1));
  expect(made.status).toBe(200);
  const url = new URL(made.body.url);
  expect(url.port).toBe('8787');
  const result = await request(app).post('/api/auth/link').set('Origin', 'http://192.168.1.20:8787').send({ code: url.searchParams.get('ma') });
  expect(result.status).toBe(200);
  expect(result.body.user.email).toBe('mac@example.test');
});

it.each(['http://8.8.8.8:8787','http://192.168.1.20:8788','https://192.168.1.20:8787','http://localhost:8787.evil.test','http://192.168.1.20:8787/path','null'])(
  'rejects a forged 8787 origin: %s', async origin => {
    expect(allowedOrigin(origin)).toBe(false);
    const result = await request(app).post('/api/auth/link').set('Origin', origin).send({ code: 'x'.repeat(32) });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('BAD_ORIGIN');
  },
);

it('links need staff.manage, and other sites cannot use the sign-in endpoint', async () => {
  const staff = await request(app).post('/api/staff/1/login-link').set('Origin', 'http://localhost:8787').set('Cookie', cookie(2));
  expect(staff.status).toBe(403);
  const evil = await request(app).post('/api/auth/link').set('Origin', 'http://evil.test:8787').send({ code: 'x'.repeat(32) });
  expect([evil.status, evil.body.error.code]).toEqual([403, 'BAD_ORIGIN']);
});
