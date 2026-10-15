# TASK-012 — Video nền trang đăng nhập

- Dự án: web (`client/`).
- Người phụ trách: Claude (đặc tả, review), Codex (triển khai).
- Trạng thái: ready — Bảo duyệt ngày 2026-10-15 ("chuyển file vào thư mục luôn để bàn giao qua máy khác không bị lỗi").
- Hành động gần nhất: Claude đã chép `login-background.mp4` (2.299.383 byte) vào `client/public/login-background.mp4`; bản gốc giữ nguyên tại `C:\Users\Admin\Documents\Codex\2026-10-15\tr\outputs\`.
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-012-result.md`, đặt `ready_for_review`.
- Phạm vi duyệt: chỉ những gì ghi trong đặc tả này.

## Yêu cầu
- `client/src/pages/LoginPage.tsx`: trong `.login-page`, thêm trước nội dung:
  - `<video className="login-background" src="/login-background.mp4" autoPlay muted loop playsInline aria-hidden="true" preload="auto" />`
  - `<div className="login-shade" aria-hidden="true" />`
  - Wordmark và thẻ đăng nhập nằm trên video (z-index), bấm được bình thường.
- `client/src/style.css`:
  - `.login-page`: `position: relative; overflow: hidden;` giữ nền gradient hiện có làm nền dự phòng.
  - `.login-background`: `position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; z-index: 0;`
  - `.login-shade`: `position: fixed; inset: 0; background: rgba(0,0,0,.38); pointer-events: none; z-index: 0;`
  - Nội dung (`.login-wordmark`, `.login-card`): `position: relative; z-index: 1;`
  - `@media (prefers-reduced-motion: reduce)`: ẩn `.login-background`.
- Đường dẫn video tương đối với gốc site (`/login-background.mp4`), không dùng đường dẫn tuyệt đối trên máy.
- Video lỗi tải: trang vẫn hiện gradient và thẻ đăng nhập.

## Kiểm tra
- `npm run build` đạt và `client/dist/login-background.mp4` có trong bản build.
- `npm test` đạt.
- Không tràn ngang ở 360px.

## Ngoài phạm vi
Sửa/nén video, đổi logic đăng nhập, đổi file khác ngoài `LoginPage.tsx`, `style.css`, commit.
