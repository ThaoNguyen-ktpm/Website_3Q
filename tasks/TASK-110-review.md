# TASK-110: Review của Claude

- Ngày: 30/10/2026
- Kết luận: **verified phần tự động**; chờ Bảo thử đăng nhập và mục Tài liệu ở 8787.

## Bằng chứng (Claude tự chạy)

- `npm run build` tại `Webstie`: đạt (server + frontend: tsc, vite).
- `npm test` tại `Webstie`: frontend 3 pass; vitest server 468 pass, 14 skip; lõi Sale AI 295/295.
- `Webstie/client`:
  - không còn file nào;
  - 67 file tracked chuyển vào `Webstie/.task-110-client-backup/` (18MB, đã gitignore);
  - Claude xoá các thư mục rỗng còn sót, sau khi dừng dev (vite 5173 cũ còn giữ thư mục).
- Sau `npm run dev`:
  - chỉ còn cổng 4000, 8787; không còn 5173, 4310;
  - `/` 200; `/api/documents` chưa đăng nhập 401; `/api/auth/config` có `googleClientId`.

## Cần Bảo

- Google Cloud Console, mục Authorized JavaScript origins: phải có `http://localhost:8787` (và `http://localhost`). Đăng nhập Google trên 8787 đã chạy trước đây, nhiều khả năng đã có sẵn.
- Thử: đăng nhập 8787 → Điều hành → Tài liệu (xem, hỏi đáp).

Chưa commit.
