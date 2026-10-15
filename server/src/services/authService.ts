import { env } from '../config/env.js';
import { ApiError } from '../middlewares/errorHandler.js';
import * as users from '../models/userModel.js';
import { verifyGoogleToken } from './googleTokenVerifier.js';

export const sessionMaxAge = 7 * 24 * 60 * 60 * 1000;
type User = NonNullable<Awaited<ReturnType<typeof users.findUserById>>>;
const publicUser = (user: User) => ({ id: user.id, email: user.email, role: user.role });

export function getAuthConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Đăng nhập Google chưa được cấu hình.');
  }
  return { googleClientId: env.GOOGLE_CLIENT_ID };
}

export async function loginWithGoogle(credential: string) {
  const { googleClientId } = getAuthConfig();
  const payload = await verifyGoogleToken(credential, googleClientId).catch(() => {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.');
  });
  if (!payload?.sub) {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.');
  }
  const email = payload.email?.trim().toLowerCase();
  if (payload.email_verified !== true || !email || !env.GOOGLE_ALLOWED_EMAILS.includes(email)) {
    throw new ApiError(403, 'EMAIL_NOT_ALLOWED', 'Email này không được phép đăng nhập.');
  }
  let user = await users.findUserByGoogleSub(payload.sub);
  if (!user) {
    const existing = await users.findUserByEmail(email);
    if (existing?.googleSub && existing.googleSub !== payload.sub) {
      throw new ApiError(403, 'EMAIL_NOT_ALLOWED', 'Email này không được phép đăng nhập.');
    }
    user = existing
      ? await users.linkGoogleSub(existing.id, payload.sub)
      : await users.createGoogleUser(email, payload.sub);
  }
  return publicUser(user);
}

export function createSession(userId: number, createdAt = Date.now()) {
  return JSON.stringify({ userId, createdAt });
}

export async function readSession(value: unknown) {
  if (!env.SESSION_SECRET || typeof value !== 'string') return null;
  let session;
  try { session = JSON.parse(value); } catch { return null; }
  if (!session || !Number.isSafeInteger(session.userId) || session.userId <= 0 ||
      !Number.isSafeInteger(session.createdAt) || session.createdAt > Date.now() ||
      Date.now() - session.createdAt > sessionMaxAge) return null;
  const user = await users.findUserById(session.userId);
  return user ? publicUser(user) : null;
}
