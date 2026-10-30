import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { PRIMARY_ADMIN_EMAIL, isPrimaryAdmin } from '../config/primaryAdmin.js';
import { createSession } from '../services/authService.js';
import * as staff from '../services/staffService.js';
import * as model from '../models/staffModel.js';
import * as auditModel from '../models/auditLogModel.js';
import { verifyGoogleToken } from '../services/googleTokenVerifier.js';

vi.mock('../config/env.js', () => ({ env: {
  APP_ORIGIN: 'http://localhost:8787',
  SESSION_SECRET: 'test-primary-admin-secret-at-least-32-characters',
  GOOGLE_CLIENT_ID: 'test-primary.apps.googleusercontent.com',
} }));
vi.mock('../models/rolePermissionModel.js', () => ({ list: vi.fn(async () => []) }));
vi.mock('../models/auditLogModel.js', () => ({ create: vi.fn(async () => ({})), list: vi.fn(), deleteBefore: vi.fn() }));
vi.mock('../services/googleTokenVerifier.js', () => ({ verifyGoogleToken: vi.fn() }));
vi.mock('../models/staffModel.js', () => ({
  findById: vi.fn(), findByEmail: vi.fn(), findByGoogleSub: vi.fn(), list: vi.fn(),
  create: vi.fn(), update: vi.fn(), countActiveAdmins: vi.fn(),
  transaction: vi.fn(action => action({})),
}));

type StaffRecord = NonNullable<Awaited<ReturnType<typeof model.findById>>>;
const primary: StaffRecord = {
  id: 1, email: PRIMARY_ADMIN_EMAIL, fullName: 'Admin chính', phone: null,
  role: 'ADMIN', status: 'ACTIVE', customPermissions: false, googleSub: null, permissions: [],
  lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
};
const other: StaffRecord = { ...primary, id: 2, email: 'other@example.test', fullName: 'Admin khác' };
const member: StaffRecord = { ...primary, id: 3, email: 'staff@example.test', role: 'STAFF' };
let people: StaffRecord[];
const update = vi.spyOn(staff, 'update');

function cookie(actorId: number) {
  const value = createSession(actorId);
  const signature = createHmac('sha256', 'test-primary-admin-secret-at-least-32-characters')
    .update(value).digest('base64').replace(/=+$/, '');
  return `sid=${encodeURIComponent(`s:${value}.${signature}`)}`;
}
const patch = (actorId: number, targetId: number, body: Record<string, unknown>) => request(app)
  .patch(`/api/staff/${targetId}`).set('Origin', 'http://localhost:8787')
  .set('Cookie', cookie(actorId)).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  people = [ { ...primary }, { ...other }, { ...member } ];
  // Model mocks return plain promises; no Prisma fluent queries are used by these handlers.
  vi.mocked(model.findById).mockImplementation(id => Promise.resolve(people.find(person => person.id === id) ?? null) as ReturnType<typeof model.findById>);
  vi.mocked(model.list).mockImplementation(() => Promise.resolve(people) as ReturnType<typeof model.list>);
  vi.mocked(model.update).mockImplementation((id, data) =>
    Promise.resolve({ ...people.find(person => person.id === id)!, ...data } as StaffRecord) as ReturnType<typeof model.update>);
  vi.mocked(model.findByEmail).mockImplementation(email => Promise.resolve(people.find(person => person.email === email) ?? null) as ReturnType<typeof model.findByEmail>);
  vi.mocked(model.findByGoogleSub).mockResolvedValue(null);
  vi.mocked(model.countActiveAdmins).mockResolvedValue(2);
});

describe('Primary admin controller policy', () => {
  it.each([
    { fullName: 'Changed' }, { phone: '0123456789' }, { role: 'STAFF' },
    { status: 'DISABLED' }, { permissions: ['products.view'] },
    { fullName: 'Changed', role: 'MANAGER', status: 'DISABLED', permissions: [] },
  ])('blocks another admin before calling update: %j', async body => {
    const response = await patch(other.id, primary.id, body);
    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({ code: 'FORBIDDEN', message: 'Không thể thay đổi tài khoản Admin chính.' });
    expect(update).not.toHaveBeenCalled();
    expect(model.update).not.toHaveBeenCalled();
    expect(model.transaction).not.toHaveBeenCalled();
    expect(auditModel.create).not.toHaveBeenCalled();
  });

  it('allows the primary admin to update their own name and phone', async () => {
    const response = await patch(primary.id, primary.id, { fullName: 'Tên mới', phone: '0123456789' });
    expect(response.status).toBe(200);
    expect(response.body.staff).toMatchObject({ fullName: 'Tên mới', phone: '0123456789', isPrimaryAdmin: true });
    expect(update).toHaveBeenCalledOnce();
  });

  it.each([{ role: 'STAFF' }, { status: 'DISABLED' }, { permissions: [] }])('keeps self-edit restrictions: %j', async body => {
    const response = await patch(primary.id, primary.id, body);
    expect(response.status).toBe(403);
    expect(update).toHaveBeenCalledOnce();
    expect(model.update).not.toHaveBeenCalled();
  });

  it.each([other.id, primary.id])('allows admin %i to update ordinary staff', async actorId => {
    const response = await patch(actorId, member.id, { fullName: 'Tên mới' });
    expect(response.status).toBe(200);
    expect(response.body.staff).toMatchObject({ fullName: 'Tên mới', isPrimaryAdmin: false });
    expect(model.update).toHaveBeenCalledOnce();
  });

  it('normalizes both target and actor email without granting access to a different email', async () => {
    people[0].email = `  ${PRIMARY_ADMIN_EMAIL.toUpperCase()}  `;
    expect((await patch(other.id, primary.id, { fullName: 'Blocked' })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect((await patch(primary.id, primary.id, { fullName: 'Allowed' })).status).toBe(200);
  });

  it.each([undefined, '', 'nvthao.12a5.20@gmail.com.other', 'other@example.test'])('does not identify %s as primary', email => {
    expect(isPrimaryAdmin(email)).toBe(false);
  });

  it('lets the existing update service return 404 for a missing target', async () => {
    const response = await patch(other.id, 99, { fullName: 'Missing' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(update).toHaveBeenCalledOnce();
    expect(model.update).not.toHaveBeenCalled();
  });

  it('does not write when the target lookup fails', async () => {
    vi.mocked(model.findById).mockImplementation(id => (id === primary.id
      ? Promise.reject(new Error('lookup failed'))
      : Promise.resolve(people.find(person => person.id === id) ?? null)) as ReturnType<typeof model.findById>);
    expect((await patch(other.id, primary.id, { fullName: 'Blocked' })).status).toBe(500);
    expect(update).not.toHaveBeenCalled();
    expect(model.update).not.toHaveBeenCalled();
  });

  it('adds the primary flag to staff without exposing private Google fields', async () => {
    people[0].email = ` ${PRIMARY_ADMIN_EMAIL.toUpperCase()} `;
    const response = await request(app).get('/api/staff').set('Cookie', cookie(other.id));
    expect(response.status).toBe(200);
    expect(response.body.staff.map((person: { isPrimaryAdmin: boolean }) => person.isPrimaryAdmin)).toEqual([true, false, false]);
    expect(response.body.staff[0]).toMatchObject({ id: primary.id, email: people[0].email, role: 'ADMIN' });
    expect(response.body.staff[0]).not.toHaveProperty('googleSub');
  });

  it.each([primary.id, other.id, member.id])('adds a boolean flag to /me for user %i', async actorId => {
    people[0].email = ` ${PRIMARY_ADMIN_EMAIL.toUpperCase()} `;
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie(actorId));
    expect(response.status).toBe(200);
    expect(response.body.user.isPrimaryAdmin).toBe(actorId === primary.id);
  });

  it.each([primary.id, other.id])('provides the same flag immediately after Google login for %i', async actorId => {
    const person = people.find(person => person.id === actorId)!;
    vi.mocked(verifyGoogleToken).mockResolvedValue({ sub: 'test-google-sub', email: person.email, email_verified: true,
      iss: 'https://accounts.google.com', aud: 'test-primary.apps.googleusercontent.com', iat: 1, exp: 2 });
    const response = await request(app).post('/api/auth/google').set('Origin', 'http://localhost:8787').send({ credential: 'test-token' });
    expect(response.status).toBe(200);
    expect(response.body.user.isPrimaryAdmin).toBe(actorId === primary.id);
  });
});
