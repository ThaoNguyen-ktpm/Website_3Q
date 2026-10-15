# TASK-009 — Review đăng nhập MVC

- Dự án: web.
- Người review: Claude.
- Trạng thái: verified.
- Hành động gần nhất: đọc toàn bộ diff và file mới, chạy lại build/test, kiểm tra giao diện trên trình duyệt.
- Bước tiếp theo: người dùng chọn cơ chế giữ phiên (cookie hoặc JWT) và giới hạn số lần thử cho task sau; sửa `server/.env` và chạy migration SQLite để thử với database thật.

## Phạm vi đã xem
`server/src/{models/userModel,services/authService,controllers/authController,routes/authRoutes,app,tests/auth.test}.ts`, `client/src/{api/auth.ts,pages/LoginPage.tsx,App.tsx,components/Header.tsx,style.css}`.

## Bằng chứng kiểm tra độc lập
- `npm run build` tại `D:\Website_3Q`: đạt (server tsc, client tsc + vite build).
- `npm test`: 3 file, 22/22 test đạt (Vitest 5.0.3).
- Không có chuỗi `a1radar` trong `server/`, `client/`.
- Trình duyệt, Vite dev + API (`DATABASE_URL=file:./dev.db` chỉ đặt cho tiến trình, không sửa `.env`):
  - `/dang-nhap` hiện tiêu đề, ô Email/Mật khẩu có label, nút Google `disabled` ghi "chưa hỗ trợ".
  - Gửi form: lỗi hiện trong thẻ (`role="alert"`).
  - Viewport 360px: `scrollWidth` 360, thẻ rộng 328px, không tràn ngang.
  - Body sai qua proxy Vite: 400 `VALIDATION_ERROR` đúng thông điệp.
- Giới hạn: API trả 500 cho cả `/api/products` lẫn `/api/auth/login` vì `server/prisma/dev.db` (12/10) chưa chạy migration SQLite hiện tại và `server/.env` còn URL MySQL. Lỗi môi trường có từ trước, ngoài phạm vi task; chưa kiểm chứng đăng nhập thành công với database thật.

## Phát hiện
### L1 — Trung bình — Lộ email tồn tại qua thời gian phản hồi
`server/src/services/authService.ts:6`: email không tồn tại trả `null` ngay, không chạy bcrypt; email tồn tại chạy `bcrypt.compare` (cost 10, vài chục ms). Đo thời gian phản hồi là phân biệt được email có tài khoản, trái yêu cầu "Không tiết lộ email có tồn tại hay không" trong đặc tả.

Yêu cầu sửa: khi không có user, vẫn chạy `bcrypt.compare` với một hash giả cố định cùng cost với seed (10), rồi trả `null`. Hash giả tạo một lần (lazy hoặc lúc nạp module), không chứa mật khẩu thật. Thêm test: khi model trả `null`, `bcrypt.compare` vẫn được gọi đúng 1 lần.

### Ghi chú (không bắt buộc sửa)
- `authController.ts:7`: `z.string().email()` đã deprecated trong zod 4; có thể dùng `z.email()` sau `trim/toLowerCase` bằng `z.string().trim().toLowerCase().max(191).pipe(z.email())`. Hành vi hiện tại đúng.

## Kết luận
changes_requested — chỉ L1. Phần còn lại đạt tiêu chí nghiệm thu đã kiểm chứng được.

## Review lại sau khi sửa
- `authService.ts`: khi không có user vẫn chạy `bcrypt.compare` với hash giả cost 12, tạo một lần lúc nạp module; trả `null` kể cả khi hash giả khớp. L1 đã sửa.
- Đính chính review: seed dùng cost 12 (`server/prisma/seed.ts:54`), không phải 10; Codex chọn 12 là đúng.
- Zod: đổi sang `.pipe(z.email())`.
- Test mới: `compare` được gọi đúng 1 lần với hash cost 12 khi email không tồn tại; hash giả khớp vẫn trả 401; spy được dọn bằng `vi.restoreAllMocks()`.
- Claude chạy lại tại `D:\Website_3Q`: `npm run build` đạt; `npm test` 3 file, 24/24 đạt.

## Kết luận cuối
verified — đạt các tiêu chí nghiệm thu đã kiểm chứng. Chưa kiểm chứng đăng nhập thành công với database thật (giới hạn môi trường nêu trên).
