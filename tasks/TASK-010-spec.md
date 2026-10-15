# TASK-010 — Đăng nhập bằng Google cho BaoQLuxury (MVC)

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Claude (đặc tả, review), Codex (triển khai).
- Trạng thái: ready — Bảo duyệt "OK TASK-010" ngày 2026-10-15.
- Hành động gần nhất: Bảo chọn: chỉ đăng nhập Google; chỉ email trong danh sách; thương hiệu BaoQLuxury; phiên bằng cookie httpOnly. Bảo tự tạo Google Client ID.
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-010-result.md`, đặt `ready_for_review`.
- Phạm vi duyệt: chỉ những gì ghi trong đặc tả này. Việc ngoài phạm vi phải xin duyệt lại.

## Mục tiêu
Trang `/dang-nhap` theo bố cục ảnh mẫu Bảo gửi: nền tối, logo trên cùng, thẻ ở giữa, nhãn "PORTAL ACCESS", tiêu đề "Đăng nhập", dòng phụ "Đăng nhập vào tài khoản của bạn để tiếp tục", một nút "Tiếp tục bằng Google", dòng điều khoản. Chỉ đăng nhập bằng Google; chỉ email trong danh sách cho phép được vào.

Không dùng bất cứ file, logo, tên, CSS, font hay meta nào từ `D:\a1radar-login` (giao diện của công ty khác). Chỉ tham khảo bố cục.

## Đã cài sẵn (Claude cài theo duyệt)
`google-auth-library`, `cookie-parser`, `@types/cookie-parser` trong workspace `server`. Không thêm dependency nào khác.

## Server — route → controller → service → model
### Cấu hình
- `server/src/config/env.ts`: thêm `GOOGLE_CLIENT_ID`, `SESSION_SECRET` (≥ 32 ký tự), `GOOGLE_ALLOWED_EMAILS` (danh sách email, phân tách bằng dấu phẩy, trim + lowercase), tất cả optional. Không làm `app.ts` hay test lỗi khi thiếu.
- Thiếu `GOOGLE_CLIENT_ID` hoặc `SESSION_SECRET` → các endpoint đăng nhập trả 503 `AUTH_NOT_CONFIGURED`, "Đăng nhập Google chưa được cấu hình."
- `server/.env.example`: thêm 3 biến với giá trị rỗng/giả và chú thích. Không sửa `server/.env`.

### Endpoint (`/api/auth`)
- `GET /config` → `{ googleClientId }` (Client ID là public). Client lấy từ đây, không cần biến môi trường riêng ở client.
- `POST /google`, body zod strict `{ credential: string 1–4096 }`:
  - Xác minh ID token qua module riêng `server/src/services/googleTokenVerifier.ts` (bọc `OAuth2Client.verifyIdToken` với `audience = GOOGLE_CLIENT_ID`) để test mock được.
  - Token sai/hết hạn → 401 `INVALID_GOOGLE_TOKEN`.
  - `email_verified !== true` hoặc email không nằm trong `GOOGLE_ALLOWED_EMAILS` → 403 `EMAIL_NOT_ALLOWED`, "Email này không được phép đăng nhập." Danh sách rỗng = không ai vào được.
  - Hợp lệ: tìm user theo `googleSub`; nếu chưa có thì theo email (liên kết `googleSub` vào user có sẵn, giữ nguyên role); nếu chưa có thì tạo user role CUSTOMER.
  - Đặt cookie phiên, trả 200 `{ user: { id, email, role } }`.
- `GET /me` → 200 `{ user }` nếu phiên hợp lệ, 401 `UNAUTHENTICATED` nếu không.
- `POST /logout` → xóa cookie, 204.

### Phiên
- `cookie-parser` với `SESSION_SECRET`; cookie ký `sid`, giá trị gồm `userId` và thời điểm tạo.
- `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` khi `NODE_ENV === 'production'`, `maxAge` 7 ngày.
- Server tự kiểm tra tuổi phiên ≤ 7 ngày (không chỉ dựa vào `maxAge` của trình duyệt) và user còn tồn tại.
- Không trả hay log ID token, `passwordHash`, `SESSION_SECRET`.

### Tầng
- Model `server/src/models/userModel.ts`: tìm theo `googleSub`, theo email, theo id; cập nhật `googleSub`; tạo user.
- Service `server/src/services/authService.ts`: logic danh sách cho phép, liên kết/tạo user, tạo/đọc phiên.
- Controller `server/src/controllers/authController.ts`: validate, gọi service, đặt/xóa cookie. Không gọi Prisma trực tiếp.
- Route `server/src/routes/authRoutes.ts`, gắn tại `/api/auth` trong `app.ts`.

### Schema
- `User.passwordHash` → `String?`; thêm `googleSub String? @unique`.
- Migration mới trong `server/prisma/migrations/` sinh bằng công cụ Prisma (không sửa migration cũ). Seed hiện tại phải vẫn chạy.

## Client
- `client/package.json` + `vite.config.ts`: host dev đổi sang `localhost` (Google chỉ chấp nhận origin `http://localhost:5173` đã khai báo). Giữ cổng 5173 và proxy `/api`.
- `client/src/api/auth.ts`: `getAuthConfig`, `loginWithGoogle(credential)`, `getMe`, `logout`.
- `client/src/hooks/useAuth.ts`: trạng thái người dùng hiện tại từ `/api/auth/me`.
- `client/src/pages/LoginPage.tsx` (route `/dang-nhap`):
  - Trang toàn màn hình, không hiện `Header` chung.
  - Logo: wordmark chữ "BaoQLuxury" (chưa có file logo).
  - Nút Google: nạp script `https://accounts.google.com/gsi/client`, render nút chính thức của Google (theme tối, `text: 'continue_with'`, `locale: 'vi'`) bằng `google.accounts.id.renderButton`; callback gửi `credential` lên `POST /api/auth/google`.
  - Chưa cấu hình (503) hoặc script không tải được: hiện thông báo trong thẻ, không crash.
  - Lỗi 401/403: thông báo trong thẻ với `role="alert"`.
  - Thành công: chuyển về `/`.
  - Dòng điều khoản là chữ thường (chưa có trang chính sách), không link giả.
  - Đã đăng nhập mà vào `/dang-nhap` → chuyển về `/`.
- `Header.tsx`: chưa đăng nhập → link "Đăng nhập"; đã đăng nhập → email + nút "Đăng xuất".
- CSS mới tiền tố `.login-` trong `client/src/style.css`; không tràn ngang ở 360px.

## Kiểm thử (`server/src/tests/auth.test.ts`, mock `googleTokenVerifier` và `userModel`)
1. `/config` trả Client ID; thiếu cấu hình → 503 ở `/config`, `/google`.
2. Token hợp lệ + email trong danh sách → 200, có `Set-Cookie` `sid` với `HttpOnly` và `SameSite=Lax`.
3. Email ngoài danh sách, `email_verified` false, danh sách rỗng → 403.
4. Verifier ném lỗi → 401. Body sai/thừa trường → 400, không gọi verifier.
5. Liên kết vào user có sẵn theo email giữ nguyên role ADMIN; user mới là CUSTOMER.
6. `/me` với cookie hợp lệ → 200; không cookie, cookie giả chữ ký, cookie quá 7 ngày, user đã bị xóa → 401.
7. `/logout` → 204 và xóa cookie.
8. Response không chứa `credential`, `passwordHash`.

## Tiêu chí nghiệm thu
- `npm run build` và `npm test` tại gốc đều đạt.
- Không có chuỗi `a1radar` trong `server/`, `client/`.
- Controller không gọi Prisma; không lộ token/hash/secret.
- Đăng nhập thật với Google chỉ kiểm chứng sau khi Bảo điền Client ID; trước đó ghi rõ là chưa kiểm chứng.

## Ngoài phạm vi
Đăng nhập bằng mật khẩu, trang admin, phân quyền theo trang, đổi ngôn ngữ, nút chat, trang chính sách, rate limit, commit.
