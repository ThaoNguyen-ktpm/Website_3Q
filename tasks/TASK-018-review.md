# TASK-018 — Review: headers, CSP, rate limit, CSRF, cookie production

- Người review: Claude. Trạng thái: verified.

## Bằng chứng
- `tsc` server/client sạch; `npm test` 7 file, 143/143 đạt.
- Live qua server dev của Bảo (proxy Vite):
  - HTML `/dang-nhap`: có CSP đúng spec (dev có `'unsafe-inline'` cho script do Vite/React preamble), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.
  - API `/api/health`: không `X-Powered-By`; CSP `default-src 'none'; frame-ancestors 'none'`; header `RateLimit-*` (300/60s).
  - CSRF: POST `/api/auth/logout` với `Origin: https://evil.example` → 403; với `Origin: http://localhost:5173` → 204.
  - Rate limit: 11 lần POST `/api/auth/google` liên tiếp → 10 lần 400 (body rỗng), lần 11 → 429.
- Trình duyệt dưới CSP: nút Google, video nền, logo, font Cormorant, canvas túi 3D đều hoạt động; console không có lỗi CSP.

## Ghi nhận
- CSP production (không `unsafe-inline` script, không `ws:`) ghi ở `docs/SECURITY.md`, áp ở Caddy khi triển khai (TASK-021).
- Sau đợt thử rate limit, IP dev bị giới hạn đăng nhập tối đa 60 giây.
