# TASK-021 — Review: chuẩn bị HTTPS (chưa triển khai)

- Người review: Claude. Trạng thái: verified cho phần chuẩn bị; triển khai thật: blocked (chưa có tên miền/máy chủ).

## Bằng chứng
- `deploy/Caddyfile.example`: HTTPS tự động (Let's Encrypt), `/api/*` → 127.0.0.1:4000, SPA fallback, CSP production không `unsafe-inline` cho script và không `ws:`, HSTS, nosniff, DENY frame, Referrer-Policy, Permissions-Policy, bỏ header `Server`; cache dài cho `/assets/*`, `no-store` cho index.
- Bản build `client/dist/index.html` chỉ có `<script type="module" src="/assets/…">`, không script inline → CSP production không chặn trang.
- `docs/DEPLOY.md`: checklist 87 dòng (NODE_ENV, APP_ORIGIN, TRUST_PROXY, cookie `__Host-sid`, thêm origin vào Google OAuth, MySQL không mở Internet, sao lưu, kiểm sau triển khai).

## Giới hạn
- Máy không có `caddy` → chưa chạy `caddy adapt` kiểm cú pháp. Khối `header Cache-Control … { match status … }` cần kiểm trên Caddy thật (phụ thuộc phiên bản Caddy).
