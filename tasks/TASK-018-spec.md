# TASK-018 — Lớp bảo vệ HTTP: headers, CSP, rate limit, chống CSRF, cookie production

- Dự án: web. Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo duyệt kế hoạch bảo mật mục 3, 4, 5, 10 ("thực hiện", 2026-10-16), dùng mặc định Claude đề xuất.
- Đã cài sẵn (Claude): `helmet`, `express-rate-limit` trong workspace `server`. Không cài thêm.
- Bước tiếp theo: Codex code + test, ghi `tasks/TASK-018-result.md`.

## Cấu hình (`server/src/config/env.ts`, `server/.env.example`)
- `APP_ORIGIN` mặc định `http://localhost:5173` — origin hợp lệ của web (dùng cho CORS và kiểm Origin).
- `TRUST_PROXY` tùy chọn (số hop, vd `1`); không đặt thì không bật.
- `NODE_ENV` sẵn có.
- CORS dùng `APP_ORIGIN` thay chuỗi cứng.

## 1. Security headers (API) — `server/src/app.ts`
- `app.disable('x-powered-by')`.
- `helmet()` cho API: `contentSecurityPolicy` cho response API là `default-src 'none'; frame-ancestors 'none'`; `crossOriginResourcePolicy: same-origin`; `referrerPolicy: no-referrer`; HSTS chỉ khi `NODE_ENV === 'production'` (`max-age=15552000; includeSubDomains`).

## 2. CSP cho trang HTML — `client/vite.config.ts` (dev và preview)
`server.headers` và `preview.headers` đặt:
- `Content-Security-Policy`: `default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleusercontent.com; media-src 'self'; connect-src 'self' https://accounts.google.com/gsi/ ws://localhost:5173; frame-src https://accounts.google.com/gsi/; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- Ghi chú: Vite dev cần `'unsafe-inline'` style; React plugin dev cần inline script preamble → nếu trang trắng vì CSP thì cho phép đúng hash/`'unsafe-inline'` cho script **chỉ ở dev** (ghi rõ trong code). Bản production: CSP đặt ở Caddy (TASK-021), ghi chuỗi CSP production (không `ws:`, không unsafe-inline script) vào `docs/SECURITY.md`.
- Thêm `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` cho HTML dev.
- Trang đăng nhập (Google button, video, font, túi 3D) và admin (Google Fonts) phải chạy bình thường dưới CSP.

## 3. Rate limit — `server/src/middlewares/rateLimit.ts`
- `authLimiter`: `/api/auth/google` tối đa 10 request / 60 giây / IP.
- `apiLimiter`: toàn bộ `/api` tối đa 300 request / 60 giây / IP.
- Vượt mức → 429, body chuẩn `{ error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' } }`; header `RateLimit-*` chuẩn, không `X-RateLimit-*` cũ.
- Bỏ qua limiter khi `NODE_ENV === 'test'` trừ test riêng của limiter (cho phép tạo limiter với cấu hình test).

## 4. Chống CSRF — `server/src/middlewares/requireSameOrigin.ts`
- Áp cho mọi request `/api` có method ghi (POST, PUT, PATCH, DELETE).
- Chấp nhận khi header `Origin` === `APP_ORIGIN`; nếu không có `Origin` thì kiểm `Referer` bắt đầu bằng `APP_ORIGIN + '/'`; ngược lại 403 `{ code: 'BAD_ORIGIN', message: 'Yêu cầu không hợp lệ.' }`.
- GET/HEAD/OPTIONS không kiểm.

## 5. Cookie và proxy production — `authController.ts`, `requireAuth`/`readSession`, `app.ts`
- Tên cookie phiên: `__Host-sid` khi `NODE_ENV === 'production'` (bắt buộc `secure`, `path=/`, không `domain`), `sid` khi khác. Đọc/xóa theo đúng tên.
- `TRUST_PROXY` có giá trị → `app.set('trust proxy', Number(value))`.

## Tests (vitest + supertest)
- Header: không có `x-powered-by`; có `x-content-type-options: nosniff`, CSP API `default-src 'none'`; HSTS chỉ khi production.
- Rate limit: request thứ 11 tới `/api/auth/google` trong cửa sổ → 429 đúng body.
- CSRF: POST `/api/staff` với Origin lạ → 403 `BAD_ORIGIN`; đúng Origin → đi tiếp; không Origin + Referer đúng → đi tiếp; GET không bị chặn.
- Cookie: production đặt `__Host-sid` có `Secure`; dev đặt `sid`.
- Cập nhật test cũ gửi POST/PATCH để có `Origin` hợp lệ. Toàn bộ test hiện có vẫn đạt.

## Ngoài phạm vi
Caddy/HTTPS thật, audit log, backup, gitleaks. Không sửa code túi 3D, `.login-*`, không commit, không cài thêm gói.
