# TASK-014 — Review: admin mẫu làm trang chính, đăng nhập không cần DB

- Dự án: web.
- Người review: Claude.
- Trạng thái: verified (phần đã kiểm chứng bên dưới); đăng nhập Google thật vào admin: chờ Bảo thử.
- Bước tiếp theo: Bảo đăng nhập Google, thử 6 màn hình và nút Đăng xuất; tạo DB chính thức rồi chạy `npx prisma migrate dev --name init`.

## Claude đã làm (theo kế hoạch được duyệt 2026-10-16)
- Sao lưu `server/.env` vào scratchpad; comment `DATABASE_URL` (shop_test XAMPP) kèm ghi chú. Không tắt MySQL, không xóa database `shop_test`.
- Xóa `server/prisma/migrations/20261012000000_init_shop/`, `20261015000000_google_login/` (Bảo xác nhận; còn trong commit `fbbecb6`). Giữ `migration_lock.toml`, `schema.prisma`.
- Chép mã nguồn admin mẫu vào `client/src/admin/` (bản gốc giữ nguyên).

## Bằng chứng
- `prisma validate` với URL giả: schema hợp lệ (không có `DATABASE_URL` thật thì validate báo P1012 — đúng dự kiến).
- `npm run build` đạt (cảnh báo chunk > 500 kB có từ trước, do bundle 3D); `npm test` 4 file, 55/55 đạt.
- Server chạy khi không có DB: `/api/health` 200, `/api/auth/config` 200, `/api/auth/me` không cookie 401.
- Đọc code: `authService.ts` không import Prisma/userModel; phiên `{ email, createdAt }` ký, ≤ 7 ngày, email phải còn trong `GOOGLE_ALLOWED_EMAILS`; vai trò `ADMIN` cho mọi email được phép (giả định ghi trong spec).
- `App.tsx`: `/` → `AdminPage` (không Header cũ), lazy-load; CSS admin bọc trong `@scope (.admin-page)` nên không lan sang trang đăng nhập.
- Trình duyệt: `/` chưa đăng nhập chuyển `/dang-nhap`; trang đăng nhập hiển thị như cũ; CSS admin chưa nạp.
- Kết xuất thử component admin trong khung `.admin-page` (không tạo phiên giả): font Be Vietnam Pro, nền #f6f7fb, 6 mục menu, biểu đồ, email + nút Đăng xuất hiển thị.
- Code túi 3D không đổi.

## Phát hiện
- Nhỏ: ở 1024px, khối email + "Đăng xuất" trên thanh trên xếp chật thành 2 dòng. Không chặn nghiệm thu.

## Giới hạn
- Chưa thử đăng nhập Google thật vào admin (cần tài khoản của Bảo).
- `/api/products` và seed vẫn cần DB; giao diện admin không gọi chúng (dữ liệu mẫu + localStorage).
