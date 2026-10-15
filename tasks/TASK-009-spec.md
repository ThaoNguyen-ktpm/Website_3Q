# TASK-009 — Trang đăng nhập và API đăng nhập (MVC)

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Claude (đặc tả, review), Codex (triển khai).
- Trạng thái: ready.
- Hành động gần nhất: người dùng yêu cầu gắn trang đăng nhập vào web theo cấu trúc MVC, tham khảo giao diện `D:\a1radar-login`.
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-009-result.md`, đặt `ready_for_review`.

## Mục tiêu
Người dùng mở `/dang-nhap`, nhập email và mật khẩu, bấm "Đăng nhập". Client gọi `POST /api/auth/login`. Server kiểm tra tài khoản trong bảng `User` bằng bcrypt và trả thông tin người dùng hoặc lỗi thống nhất.

## Phạm vi
### Server — đúng luồng route → controller → service → model hiện có
- `server/src/models/userModel.ts`: `findUserByEmail(email)` dùng Prisma, select `id`, `email`, `role`, `passwordHash`.
- `server/src/services/authService.ts`: `login(email, password)`; so sánh bằng `bcrypt.compare`; trả `{ id, email, role }` hoặc `null`. Không bao giờ trả `passwordHash`.
- `server/src/controllers/authController.ts`: validate body bằng zod `.strict()`: `email` là email hợp lệ (trim, lowercase, tối đa 191 ký tự), `password` là chuỗi 1–128 ký tự.
  - Body sai: 400 `VALIDATION_ERROR`, message "Email hoặc mật khẩu không hợp lệ."
  - Sai email hoặc sai mật khẩu: 401 `INVALID_CREDENTIALS`, message chung "Email hoặc mật khẩu không đúng." Không tiết lộ email có tồn tại hay không.
  - Đúng: 200 `{ user: { id, email, role } }`.
- `server/src/routes/authRoutes.ts`: `POST /login`; gắn vào `app.ts` tại `/api/auth`.
- Lỗi đi qua `ApiError` và `errorHandler` hiện có.

### Client
- `client/src/api/auth.ts`: `login(email, password)` gọi `POST /api/auth/login`. Đọc `error.message` từ response lỗi để hiển thị.
- `client/src/pages/LoginPage.tsx`: route `/dang-nhap` trong `App.tsx`.
  - Bố cục tham khảo `D:\a1radar-login`: nền tối, một thẻ ở giữa, tiêu đề "Đăng nhập", dòng phụ "Đăng nhập vào tài khoản của bạn để tiếp tục".
  - Form gồm ô email, ô mật khẩu (`type="password"`, có `label`, `autocomplete` phù hợp), nút "Đăng nhập".
  - Khi đang gửi: nút bị khóa. Lỗi hiện trong thẻ với `role="alert"`. Thành công: hiện "Đã đăng nhập: <email>" và link về trang chủ.
  - Nút "Tiếp tục bằng Google" chỉ là giao diện, `disabled`, ghi rõ "chưa hỗ trợ".
- `Header.tsx`: thêm link "Đăng nhập" tới `/dang-nhap`.
- CSS viết mới trong `client/src/style.css` (tiền tố `.login-`), responsive tới 360px.

### Kiểm thử
`server/src/tests/auth.test.ts` (vitest + supertest, mock `userModel` như `products.test.ts`, hash bcrypt tạo trong test với cost thấp):
1. Đúng email/mật khẩu → 200, đúng body, không có `passwordHash`.
2. Sai mật khẩu → 401 `INVALID_CREDENTIALS`.
3. Email không tồn tại → 401, cùng body với trường hợp 2.
4. Thiếu trường / email sai định dạng / có trường thừa → 400 `VALIDATION_ERROR`, không gọi model.
5. Email được trim + lowercase trước khi gọi model.

## Ngoài phạm vi
- Không chép `index.html`, `style.css`, logo, font, tên "A1Radar" hay meta/og trỏ `a1radar.com` từ `D:\a1radar-login`. Đó là giao diện và thương hiệu của công ty khác; chỉ tham khảo bố cục.
- Không làm phiên đăng nhập (cookie/JWT), đăng xuất, đăng ký, quên mật khẩu, Google OAuth, phân quyền trang admin, giới hạn số lần thử.
- Không thêm dependency mới. Không đổi schema/migration.

## Tiêu chí nghiệm thu
- `npm run build` và `npm test` tại gốc đều đạt.
- Không có file nào trong `server/`, `client/` chứa chuỗi `a1radar` (không phân biệt hoa thường).
- Response và log không chứa mật khẩu hoặc `passwordHash`.
- Code mới theo đúng tầng MVC; controller không gọi Prisma trực tiếp.

## Điểm còn cần quyết định (không làm trong task này)
- Cơ chế giữ phiên: cookie httpOnly hay JWT.
- Giới hạn số lần đăng nhập sai.
- Có cần Google OAuth thật không.
