# TASK-021 — Kết quả chuẩn bị HTTPS

- Dự án: vận hành / web (`D:\Website_3Q`).
- Người phụ trách: Codex triển khai; Claude review độc lập.
- Trạng thái: `ready_for_review`.
- Ngày: 2026-10-16.
- Hành động gần nhất: tạo cấu hình mẫu và checklist, kiểm tra tĩnh, chạy build/test hiện có.
- Bước tiếp theo: Claude kiểm tra độc lập ba file; chạy lại build/test trong môi trường cho phép tạo tiến trình con, kiểm tra `caddy adapt` khi có Caddy. Kiểm tra HTTPS/OAuth thật khi có máy chủ và tên miền được phép triển khai.

## Thay đổi

Chỉ tạo ba file theo đặc tả và yêu cầu trực tiếp của Bảo:

- `deploy/Caddyfile.example`: hostname từ `APP_DOMAIN`, ACME Let's Encrypt, nén zstd/gzip, proxy nguyên đường dẫn `/api/*` tới `127.0.0.1:4000`, static root `/srv/baoq/client/dist` và SPA fallback. CSP khớp nguyên chuỗi production trong `docs/SECURITY.md`; đầy đủ HSTS, nosniff, DENY, Referrer-Policy, Permissions-Policy và xóa Server. Assets thành công cache immutable một năm; asset thiếu không fallback HTML/cache immutable; HTML và SPA fallback dùng no-store.
- `docs/DEPLOY.md`: checklist build, env production, proxy một hop, cookie `__Host-sid`, Google OAuth origins, firewall API/MySQL, user DB quyền tối thiểu, backup/restore, lệnh kiểm tra và tiêu chí HTTPS/header/cache/OAuth/403/429. Phân biệt biến Caddy/API và shell PowerShell/Linux; ghi rõ backup Windows chưa phải giải pháp đã kiểm chứng trên máy chủ Linux.
- `tasks/TASK-021-result.md`: báo cáo này.

Đã đọc AGENTS.md, Ponytail full, tasks/README.md, đặc tả TASK-021, SECURITY.md, BACKUP.md, review TASK-018/TASK-020 và code/env/scripts liên quan. Chưa có review TASK-021 tại thời điểm triển khai. Các thay đổi có sẵn trong working tree được giữ nguyên; không sửa mã ứng dụng, không stage/commit, không cài gì, không đổi DNS, không khởi động Caddy/API, không chạy migration/backup hoặc thao tác tài khoản thật.

## Bằng chứng kiểm tra cục bộ

- `Get-Command caddy -ErrorAction SilentlyContinue`: không tìm thấy Caddy trong PATH. **Chưa chạy `caddy adapt`, chưa xác minh cú pháp bằng Caddy.** Không cài thêm theo yêu cầu.
- Self-check Node chạy trực tiếp qua stdin, không tạo file test: **PASS**. So sánh bằng assert chuỗi CSP với khối production trong SECURITY.md; kiểm tra các directive/header/cache bắt buộc, không có `handle_path`, không inline script/`ws:`, các mục checklist, file đích tham chiếu và whitespace. Lần chạy đầu vướng encoding PowerShell khi truyền literal tiếng Việt vào Node; đã bỏ literal tiếng Việt khỏi assert và chạy lại thành công, không đổi nội dung tài liệu. Đây chỉ là kiểm tra văn bản, không thay thế parser Caddy hoặc kiểm tra HTTP.
- `npm.cmd run build` tại gốc: **exit 1**. `tsc -p tsconfig.json` server và `tsc -b` client đi qua; Vite không tải được config vì esbuild `spawn EPERM`. Chưa có build production hoàn chỉnh được xác nhận trong lượt này.
- `npm.cmd test` tại gốc: **exit 1**. Vitest không khởi tạo được forks worker (`spawn EPERM`), báo 8 lỗi, `no tests`; không có test nào được xác nhận đạt trong lượt này. Không thay pool/config để né lỗi và không yêu cầu nâng quyền.
- `git diff --check`: exit 0 cho diff được Git theo dõi hiện có, chỉ cảnh báo LF/CRLF. Ba file mới chưa được stage; self-check kiểm tra riêng whitespace của Caddyfile và DEPLOY.md.

## Giới hạn và nguồn

Chưa triển khai thật, chưa kiểm chứng DNS/chứng chỉ/gia hạn, header và cache qua HTTP, Google Sign-In thật, cookie trình duyệt, firewall, backup máy chủ hoặc 429/403 trên hệ thống thật. Checklist mô tả việc cần làm sau này, không phải bằng chứng đã thực hiện. Build/test có lỗi tạo tiến trình con trong môi trường hiện tại; chưa kết luận đó là lỗi ứng dụng. Cấu hình/tài liệu đã hoàn tất để review, **chưa được Claude kiểm tra độc lập**.

Đối chiếu tài liệu chính thức Caddy: [handle](https://caddyserver.com/docs/caddyfile/directives/handle) (route loại trừ nhau, giữ đường dẫn), [header](https://caddyserver.com/docs/caddyfile/directives/header) (thao tác deferred khi có xóa header, response matcher), [tls](https://caddyserver.com/docs/caddyfile/directives/tls) (ACME issuer). Việc đọc tài liệu không thay thế kiểm tra cấu hình bằng binary Caddy.
