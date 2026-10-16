# TASK-014 — Trang admin mẫu làm trang chính; đăng nhập Google không cần DB

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Claude (đặc tả, review), Codex (triển khai).
- Trạng thái: ready — Bảo duyệt kế hoạch ngày 2026-10-16.
- Hành động gần nhất (Claude đã làm): `server/.env` đã comment `DATABASE_URL` (ngắt XAMPP `shop_test`); đã xóa 2 migration cũ (Bảo xác nhận); đã chép mã nguồn admin mẫu vào `client/src/admin/` (`views/App.jsx`, `controllers/useAdminController.js`, `models/storeModel.js`, `components/Icon.jsx`, `components/Charts.jsx`, `styles.css`).
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-014-result.md`, đặt `ready_for_review`.
- Phạm vi duyệt: chỉ đặc tả này.

## Mục tiêu
Đăng nhập Google xong, `/` hiển thị trang quản trị mẫu (dữ liệu mẫu, localStorage). Web chạy được khi không có database.

## Server — đăng nhập không cần DB
- `server/src/services/authService.ts`: bỏ mọi lời gọi `userModel`/Prisma. Sau khi xác minh token, `email_verified === true` và email (trim, lowercase) nằm trong `GOOGLE_ALLOWED_EMAILS` → người dùng công khai `{ email, role: 'ADMIN' }`. **Giả định:** mọi email được phép là nhân viên nội bộ vai trò ADMIN; chờ Bảo xác nhận khi có DB.
- Phiên `sid` (cookie ký bằng cookie-parser như hiện tại): nội dung `{ email, createdAt }`. `readSession`: chữ ký hợp lệ, `createdAt` không ở tương lai, tuổi ≤ 7 ngày, email vẫn còn trong `GOOGLE_ALLOWED_EMAILS` (gỡ email khỏi .env = thu hồi phiên). Trả `{ email, role: 'ADMIN' }` hoặc null.
- Giữ nguyên `authController.ts`, `authRoutes.ts`, `requireAuth.ts`, mã lỗi, thông điệp, thuộc tính cookie, 503 khi thiếu cấu hình.
- Giữ file `userModel.ts` (dùng lại khi có DB) nhưng auth không import.
- `server/src/tests/auth.test.ts`: viết lại theo phiên mới (không mock userModel). Giữ các ca hiện có còn áp dụng; thêm: email bị gỡ khỏi danh sách → `/me` 401; `/google` thành công không gọi Prisma. `products.test.ts`, `authConfig.test.ts` vẫn đạt.

## Client — admin làm trang chính
- `client/src/api/auth.ts`: `AuthUser = { email: string; role: 'ADMIN' | 'CUSTOMER' }` (bỏ `id`); sửa chỗ dùng nếu có.
- `client/src/pages/AdminPage.tsx`: `React.lazy` nạp `../admin/views/App.jsx`; import `../admin/styles.css` bên trong module được lazy-load (hoặc trong AdminPage) để CSS admin chỉ tải sau đăng nhập. Fallback: "Đang tải trang quản trị…".
- `client/src/App.tsx`: trong `RequireAuth`, route `/` → `AdminPage` (truyền `auth`), **không** kèm `Header` cũ. Route `*` giữ `NotFoundPage` có `Header`. `HomePage`, `useProducts`, `ProductCard` giữ file, không còn dùng ở `/`.
- `client/src/admin/views/App.jsx`: chỉ thêm vào thanh công cụ trên cùng: email người dùng + nút "Đăng xuất" gọi `auth.signOut()`; thành công thì `navigate('/dang-nhap', { replace: true })` (hoặc nhận hàm `onSignOut` qua props). Không đổi gì khác trong mã admin.
- `client/tsconfig.json`: thêm `"allowJs": true` (không bật `checkJs`).
- CSS: `client/src/style.css` có rule chung (`:root` màu/nền, `h1`, `p`, `a`, …) sẽ xung đột với admin (admin `styles.css` cũng có `:root`, `body`, `button`, `h1,h2,h3,p{margin:0}`…). Giới hạn rule chung của trang cũ vào lớp/vùng của chúng (vd `.content h1`, `.site-header a`) để: trang đăng nhập hiển thị như hiện tại; admin hiển thị như bản mẫu. Không sửa rule `.login-*`, `.login-layout`, `.login-panel`, `.login-bag` và mọi code túi 3D.
- Không cài dependency; giữ Google Fonts như bản mẫu.

## Tiêu chí nghiệm thu
- `npm run build`, `npm test` đạt.
- Server chạy khi không có `DATABASE_URL`; `/api/auth/config` 200, `/api/auth/me` không cookie 401.
- Không file nào trong luồng auth import Prisma/userModel.
- `/dang-nhap` hiển thị như trước khi có admin.

## Ngoài phạm vi
Nối API thật cho admin, đổi tên Maison/màu, DB mới, migration mới, sửa `server/.env`, commit, xóa file.
