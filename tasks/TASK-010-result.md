# TASK-010 — Đăng nhập Google BaoQLuxury

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Codex (triển khai); Claude (review độc lập).
- Trạng thái: `ready_for_review` theo yêu cầu bàn giao; chưa đạt toàn bộ tiêu chí nghiệm thu.
- Hành động gần nhất: triển khai code, bổ sung test, chạy build/test và kiểm tra cục bộ ngày 2026-10-15.
- Bước tiếp theo: Claude review code; sinh migration bằng Prisma CLI và chạy lại các kiểm tra trong môi trường cho phép spawn. Chưa được Claude kiểm tra độc lập.

## Thay đổi

- Server: thêm `/api/auth/config`, `/google`, `/me`, `/logout` theo route → controller → service → model. Verifier riêng dùng `OAuth2Client.verifyIdToken` với audience từ cấu hình.
- Cấu hình tùy chọn: Client ID được trim, allowlist được trim/lowercase; thiếu Client ID hoặc secret đủ 32 ký tự thì đăng nhập trả 503 `AUTH_NOT_CONFIGURED`. Allowlist rỗng từ chối mọi email.
- Đăng nhập chỉ nhận body strict có credential dài 1–4096; token không hợp lệ trả 401, email không được phép/chưa xác minh trả 403. Liên kết user theo Google sub rồi email, giữ role hiện có; user mới là CUSTOMER. Không ghi đè email đã liên kết với Google sub khác.
- Phiên `sid` ký bằng cookie-parser, httpOnly, SameSite=Lax, Path=/, Secure ở production, thời hạn 7 ngày. Server kiểm tra thời điểm tạo, chữ ký và user còn tồn tại. Response chỉ chọn id/email/role; không log token/hash/secret.
- Schema: passwordHash nullable, thêm googleSub unique nullable. Không sửa migration cũ. **Chưa có migration mới vì Prisma CLI lỗi spawn EPERM**, chi tiết bên dưới.
- Client: `/dang-nhap` nền tối, wordmark BaoQLuxury, thẻ PORTAL ACCESS, nút Google chính thức với filled_black/continue_with/vi; thông báo lỗi trong thẻ, timeout script, chuyển về `/` sau đăng nhập hoặc khi đã có phiên. Điều khoản là văn bản thường.
- Một hook auth được gọi ở cấp ứng dụng và truyền trạng thái xuống Header/LoginPage; Header hiển thị đăng nhập hoặc email/đăng xuất. Ẩn Header tại route đăng nhập, kể cả dấu `/` cuối và khác hoa/thường.
- Dev host đổi thành localhost, giữ port 5173 và proxy `/api`. CSS đăng nhập dùng tiền tố `.login-`, chiều rộng co theo màn hình.
- Error handler trả 400 cho JSON sai cú pháp/thân JSON primitive bị express.json từ chối, không đưa nội dung request vào lỗi.

## File liên quan

- `server/src/config/env.ts`, `server/.env.example`, `server/src/app.ts`.
- `server/src/models/userModel.ts`, `server/src/services/authService.ts`, `server/src/services/googleTokenVerifier.ts`.
- `server/src/controllers/authController.ts`, `server/src/routes/authRoutes.ts`, `server/src/middlewares/errorHandler.ts`.
- `server/prisma/schema.prisma`.
- `server/src/tests/auth.test.ts`, `server/src/tests/authConfig.test.ts`.
- `client/src/api/auth.ts`, `client/src/hooks/useAuth.ts`, `client/src/pages/LoginPage.tsx`.
- `client/src/App.tsx`, `client/src/components/Header.tsx`, `client/src/style.css`, `client/package.json`, `client/vite.config.ts`.

## Kiểm tra thực tế

Các lệnh chạy tại `D:\Website_3Q`, dùng `npm.cmd` trong PowerShell. Không cài dependency.

- `npm.cmd run build`: **không đạt, exit 1**. Server tsc và client tsc chạy qua; Vite không load được config do esbuild `Error: spawn EPERM`. Không coi kiểm tra kiểu thành build đạt.
- `npm.cmd test`: **không đạt, exit 1**. Vitest báo 4 lỗi khởi tạo forks worker (`spawn EPERM`), không có test nào chạy; sau đó timeout khi đóng worker. Không có số test pass.
- Thử bổ sung `npm.cmd run test --workspace server -- --pool=threads` trước khi thêm file authConfig: **không đạt, exit 1**. Cả 3 suite lúc đó không chạy được do Vite `optimizeSafeRealPathSync` báo `spawn EPERM`. Không đổi cấu hình test của dự án để né lỗi.
- `node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck server/src/tests/auth.test.ts server/src/tests/authConfig.test.ts`: **đạt, exit 0** sau thay đổi cuối. Đây chỉ là kiểm tra kiểu, không chạy assertions.
- Cùng tùy chọn tsc với `server/prisma/seed.ts`: **đạt, exit 0**. Seed vẫn tương thích kiểu; chưa chạy seed với database.
- Smoke assertions bằng Node + supertest trên `server/dist/app.js` được tsc tạo trong lần build cuối, đặt Client ID/secret rỗng chỉ cho tiến trình: **đạt, exit 0**. `/config` và `/google` trả 503 `AUTH_NOT_CONFIGURED`; `/me` không cookie trả 401; logout trả 204 kèm cookie bị xóa; health trả 200. Không gọi Google/database. Smoke này không thay thế `npm test`.
- Rà source server/client: không thấy chuỗi thương hiệu bị cấm; controller auth không import/gọi Prisma. `git diff --check` đạt (chỉ có cảnh báo LF/CRLF).

Test đã viết dùng mock verifier và userModel cho các trường hợp trong spec: audience/cấu hình; allowlist/email_verified; token lỗi; body strict và giới hạn độ dài; liên kết ADMIN/tạo CUSTOMER; cookie ký, HttpOnly/SameSite/Path/Max-Age/Secure; phiên giả/unsigned/hỏng/quá hạn/tương lai/user bị xóa; biên đúng 7 ngày; logout; response loại hash/token/secret và lỗi nội bộ. Có test riêng cho cấu hình optional/chuẩn hóa email/độ dài secret. **Assertions của các test này chưa chạy được.**

## Prisma: phần còn thiếu

Đã tạo bản schema trước thay đổi tạm thời trong `server/prisma/` và gọi đúng Prisma CLI đã cài:

```powershell
node node_modules/prisma/build/index.js migrate diff --from-schema-datamodel server/prisma/task-010-before.prisma --to-schema-datamodel server/prisma/schema.prisma --script --output server/prisma/migrations/20261015000000_google_auth/migration.sql
```

Kết quả: **exit 1, `Error: spawn EPERM`**. Không tạo được SQL. Đã dọn bản schema tạm và thư mục migration rỗng do lượt này tạo; không viết tay SQL, không sửa migration cũ, không kết nối hay áp dụng migration vào database.

`node node_modules/prisma/build/index.js generate --schema server/prisma/schema.prisma`: **exit 1**, `EPERM: operation not permitted, rename ...query_engine-windows.dll.node.tmp1836 -> ...query_engine-windows.dll.node`. Các kiểu generated hiện tại đủ để tsc chạy qua nhưng không coi generate là thành công.

Để hoàn tất trong môi trường không bị EPERM: lấy schema trước thay đổi từ `git show HEAD:server/prisma/schema.prisma` vào file tạm trong server, tạo thư mục migration mới, chạy lại lệnh diff trên bằng Prisma CLI, kiểm tra SQL, dọn file tạm, chạy lại generate/build/test. Migration phải chỉ chứa thay đổi passwordHash/googleSub, không thay đổi các bảng khác.

## Giới hạn và phạm vi

- Chưa kiểm chứng giao diện bằng trình duyệt hoặc đo scrollWidth ở 360px; CSS đã co chiều rộng nhưng chưa có bằng chứng layout thực tế.
- Chưa đăng nhập Google thật, chưa kiểm chứng liên kết/tạo user/seed trên MySQL. Không đọc hay sửa `server/.env`; không truy cập thư mục tham chiếu bị cấm.
- Không cài thêm dependency, không commit, không kết nối KiotViet/Sapo/thanh toán hay thay đổi dữ liệu dịch vụ thật. Chỉ sửa source trong server/client và báo cáo này.
- `server/package.json`, `package-lock.json` và nhiều file staged ngoài phạm vi đã có thay đổi trước khi triển khai; giữ nguyên các thay đổi có sẵn, không stage/unstage chúng.
- Review TASK-009 có nhắc code auth không tồn tại trong checkout lúc bắt đầu; triển khai dựa trên code/schema MySQL thực tế và đặc tả TASK-010 mới nhất, không khôi phục cơ chế đăng nhập mật khẩu cũ.
- Không triển khai đăng nhập mật khẩu, admin/phân quyền trang, chính sách, rate limit hay các tính năng ngoài spec.
