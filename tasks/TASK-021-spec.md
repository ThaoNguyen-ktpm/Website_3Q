# TASK-021 — Chuẩn bị HTTPS khi triển khai (chưa triển khai thật)

- Dự án: vận hành. Người phụ trách: Claude (đặc tả, review), Codex (tài liệu/cấu hình mẫu).
- Trạng thái: ready — Bảo duyệt kế hoạch bảo mật mục 9, 10 ("thực hiện", 2026-10-16). Chưa có tên miền/máy chủ → chỉ chuẩn bị, không cài Caddy, không đổi DNS.

## Yêu cầu
- `deploy/Caddyfile.example`: site `{$APP_DOMAIN}` (HTTPS tự động Let's Encrypt), `encode zstd gzip`; `/api/*` → `reverse_proxy 127.0.0.1:4000`; còn lại → `root * /srv/baoq/client/dist`, `try_files {path} /index.html`, `file_server`; header: CSP production lấy đúng chuỗi trong `docs/SECURITY.md` (không `unsafe-inline` script, không `ws:`), `Strict-Transport-Security "max-age=15552000; includeSubDomains"`, `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy "camera=(), microphone=(), geolocation=()"`, `-Server`. Cache dài cho `/assets/*` (immutable), không cache `index.html`.
- `docs/DEPLOY.md`: checklist triển khai: build client, chạy server với `NODE_ENV=production`, `APP_ORIGIN=https://<tên miền>`, `TRUST_PROXY=1`; cookie sẽ thành `__Host-sid` (cần HTTPS); thêm origin `https://<tên miền>` vào Google OAuth Client (Authorized JavaScript origins); MySQL không mở ra Internet; user DB riêng quyền tối thiểu; sao lưu (`docs/BACKUP.md`); kiểm tra sau triển khai (securityheaders, `curl -I`, đăng nhập Google, 429/403).
- Kiểm tra cú pháp Caddyfile nếu có `caddy` trên máy (`caddy adapt`); nếu không có thì ghi rõ chưa kiểm.
- Ghi `tasks/TASK-021-result.md`. Chỉ tạo `deploy/Caddyfile.example`, `docs/DEPLOY.md`, result. Không commit.
