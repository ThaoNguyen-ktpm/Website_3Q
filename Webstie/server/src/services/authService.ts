import { env } from '../config/env.js';
import { ApiError } from '../middlewares/errorHandler.js';
import { verifyGoogleToken } from './googleTokenVerifier.js';

import * as staffModel from '../models/staffModel.js';
import { publicUser } from './staffService.js';
import * as audit from './auditService.js';
import { consumeLink } from './loginLinkService.js';

export const sessionMaxAge = 7 * 24 * 60 * 60 * 1000;

export function getAuthConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Đăng nhập Google chưa được cấu hình.');
  }
  return { googleClientId: env.GOOGLE_CLIENT_ID };
}

export async function loginWithGoogle(credential: string, ip?: string) {
  const { googleClientId } = getAuthConfig();
  const payload = await verifyGoogleToken(credential, googleClientId).catch(() => {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.');
  });
  if (!payload?.sub) {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.');
  }
  const email = payload.email?.trim().toLowerCase();
  const deny = async (reason: 'not_staff' | 'disabled' | 'unverified_email' | 'sub_mismatch', actorId?: number): Promise<never> => {
    await audit.record({ actor: { id: actorId, email }, action: 'auth.login_denied', after: { reason }, ip });
    throw new ApiError(403, 'EMAIL_NOT_ALLOWED', 'Email này không được phép đăng nhập.');
  };
  if (payload.email_verified !== true || !email) {
    return deny('unverified_email');
  }
  const staff = await staffModel.findByEmail(email);
  if (!staff) return deny('not_staff');
  if (staff.status !== 'ACTIVE') return deny('disabled', staff.id);
  if (staff.googleSub && staff.googleSub !== payload.sub) return deny('sub_mismatch', staff.id);
  const linked = await staffModel.findByGoogleSub(payload.sub);
  if (linked && linked.id !== staff.id) return deny('sub_mismatch', staff.id);
  const user = await staffModel.transaction(async db => {
    const current = await staffModel.findById(staff.id, db);
    if (!current || current.status !== 'ACTIVE' || (current.googleSub && current.googleSub !== payload.sub)) {
      return deny(!current ? 'not_staff' : current.status !== 'ACTIVE' ? 'disabled' : 'sub_mismatch', staff.id);
    }
    return publicUser(await staffModel.update(staff.id, { googleSub: payload.sub, lastLoginAt: new Date() }, db));
  }).catch(async error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return deny('sub_mismatch', staff.id);
    }
    throw error;
  });
  await audit.record({ actor: user, action: 'auth.login', ip });
  return user;
}

/** One-time link from the Nhân viên page (laptops on the shop wifi, where Google sign-in is not available). */
export async function loginWithLink(code: string, ip?: string) {
  if (!env.SESSION_SECRET) throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Đăng nhập chưa được cấu hình.');
  const staffId = consumeLink(code);
  const staff = staffId ? await staffModel.findById(staffId) : null;
  if (!staff || staff.status !== 'ACTIVE') {
    await audit.record({ actor: { id: staff?.id, email: staff?.email }, action: 'auth.login_denied', after: { reason: staff ? 'disabled' : 'invalid_link' }, ip });
    throw new ApiError(401, 'INVALID_LOGIN_LINK', 'Link đăng nhập không hợp lệ, đã dùng hoặc đã hết hạn. Nhờ quản lý gửi link mới.');
  }
  const user = await publicUser(await staffModel.update(staff.id, { lastLoginAt: new Date() }));
  await audit.record({ actor: user, action: 'auth.login', after: { method: 'link' }, ip });
  return user;
}

export function createSession(staffId: number, createdAt = Date.now()) {
  return JSON.stringify({ staffId, createdAt });
}

export async function readSession(value: unknown) {
  if (!env.SESSION_SECRET || typeof value !== 'string') return null;
  let session;
  try { session = JSON.parse(value); } catch { return null; }
  if (!session || !Number.isSafeInteger(session.staffId) || session.staffId <= 0 ||
      !Number.isSafeInteger(session.createdAt) || session.createdAt > Date.now() ||
      Date.now() - session.createdAt > sessionMaxAge) return null;
  const staff = await staffModel.findById(session.staffId);
  return staff?.status === 'ACTIVE' ? publicUser(staff) : null;
}
