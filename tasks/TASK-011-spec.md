# TASK-011 — Bắt đăng nhập trước khi vào web

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Claude (đặc tả, review), Codex (triển khai).
- Trạng thái: ready — Bảo duyệt "OK, chặn cả API" ngày 2026-10-15.
- Hành động gần nhất: Bảo yêu cầu trang chủ phải đăng nhập rồi mới vào được.
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-011-result.md`, đặt `ready_for_review`.
- Phạm vi duyệt: chỉ những gì ghi trong đặc tả này. Dựa trên code TASK-010 hiện có (chưa commit).

## Mục tiêu
Chưa đăng nhập thì mọi trang (trừ `/dang-nhap`) chuyển về `/dang-nhap`. Đăng nhập Google thành công thì vào trang đang muốn vào (mặc định `/`). Đăng xuất thì về `/dang-nhap`. API dữ liệu cũng yêu cầu phiên đăng nhập.

## Server
- `server/src/middlewares/requireAuth.ts`: đọc cookie ký `sid` bằng `readSession` có sẵn trong `authService`; hợp lệ thì gắn user vào `response.locals.user` rồi `next()`; không hợp lệ → `ApiError(401, 'UNAUTHENTICATED', 'Bạn chưa đăng nhập.')`. Không gọi Prisma trực tiếp.
- `app.ts`: áp `requireAuth` cho `/api/products`. `/api/health` và `/api/auth/*` vẫn mở.
- Thiếu `SESSION_SECRET` → mọi request `/api/products` trả 401 (chặn mặc định).

## Client
- Mọi route trừ `/dang-nhap` (gồm `/` và trang 404) bọc trong một guard (ví dụ `client/src/components/RequireAuth.tsx`):
  - `auth.loading` → hiện "Đang kiểm tra đăng nhập…", không nháy nội dung trang.
  - Không có user → `<Navigate to="/dang-nhap" replace state={{ from }} />`.
- `LoginPage`: đăng nhập thành công → chuyển tới `from` nếu là đường dẫn nội bộ bắt đầu bằng `/` (không phải `//`), ngược lại `/`. Đã đăng nhập mà vào `/dang-nhap` → cùng quy tắc.
- Đăng xuất (Header) → xóa user, chuyển `/dang-nhap`.
- Gọi API nhận 401 (phiên hết hạn) → xóa user ở client để guard chuyển về `/dang-nhap`; không hiện lỗi "Không thể tải sản phẩm".

## Kiểm thử
- Server (`vitest`):
  1. `GET /api/products` không cookie → 401 `UNAUTHENTICATED`, không gọi model sản phẩm.
  2. Cookie ký giả / quá 7 ngày → 401.
  3. Phiên hợp lệ → 200 như cũ; test lọc danh mục và validate hiện có vẫn đạt (cập nhật để gửi phiên hợp lệ).
  4. `/api/health` vẫn 200 không cần cookie.
- `npm run build` và `npm test` tại gốc đạt.

## Ngoài phạm vi
Phân quyền theo vai trò (ADMIN/CUSTOMER), trang admin, đổi giao diện trang chủ, commit, sửa `server/.env`.
