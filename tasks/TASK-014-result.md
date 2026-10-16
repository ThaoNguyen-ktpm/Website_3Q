# TASK-014 — Kết quả triển khai

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Codex (triển khai); Claude (review độc lập).
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: hoàn tất code, cập nhật test theo phiên email, kiểm tra TypeScript và diff ngày 2026-10-16.
- Bước tiếp theo: Claude đọc diff, chạy `npm run build`, `npm test` và kiểm tra giao diện/API theo spec. Chưa có review độc lập cho TASK-014.

## Thay đổi

- `server/src/services/authService.ts`: bỏ import và mọi lời gọi userModel/Prisma. Sau xác minh Google, yêu cầu `sub`, email đã xác minh và email chuẩn hóa thuộc allowlist; trả `{ email, role: 'ADMIN' }`. Phiên chứa `{ email, createdAt }`; đọc phiên kiểm tra kiểu dữ liệu, tuổi tối đa 7 ngày, không ở tương lai và email vẫn thuộc allowlist. Chữ ký tiếp tục được cookie-parser kiểm tra trước khi controller/middleware gọi `readSession`.
- `server/src/controllers/authController.ts`: chỉ đổi `createSession(user.id)` thành `createSession(user.email)`. Đây là điều chỉnh caller bắt buộc khi bỏ `id`; giữ nguyên phần còn lại, thuộc tính cookie, mã lỗi và thông điệp. `authRoutes.ts`, `requireAuth.ts`, `userModel.ts` giữ nguyên.
- `server/src/tests/auth.test.ts`: bỏ mock userModel; giữ các ca còn áp dụng về cấu hình, xác minh, validation, cookie, logout và tuổi phiên. Bổ sung định dạng phiên, từ chối phiên userId cũ/sai kiểu, thu hồi email và đăng nhập khi không có DATABASE_URL. Mock Prisma bằng Proxy ném lỗi nếu có truy cập, nhằm phát hiện auth quay lại dùng DB.
- `server/src/tests/products.test.ts`: cập nhật fixture/cookie sang email và allowlist; ca user bị xóa chuyển thành email bị thu hồi. Bỏ ca lỗi DB trong việc đọc phiên vì luồng đó không còn tồn tại; giữ các ca bảo vệ API, mốc 7 ngày và dữ liệu sản phẩm. Không đổi production code sản phẩm. `authConfig.test.ts` giữ nguyên.
- `client/src/api/auth.ts`: bỏ `id` khỏi `AuthUser`.
- `client/src/pages/AdminPage.tsx`: lazy-load admin mẫu, fallback đúng spec; chuyển email và callback đăng xuất qua props. Chỉ chuyển về `/dang-nhap` khi `auth.signOut()` thành công; có trạng thái chờ và hiển thị lỗi khi thất bại.
- `client/src/App.tsx`: `/` trong RequireAuth dùng AdminPage, không có Header cũ. Route `*` vẫn có Header và NotFoundPage. Giữ các file HomePage/useProducts/ProductCard.
- `client/src/admin/views/App.jsx`: import CSS trong module lazy-load; chỉ bổ sung props và email/nút đăng xuất/trạng thái lỗi vào thanh công cụ. Giữ nội dung và chức năng admin mẫu còn lại.
- `client/src/admin/styles.css`: giữ Google Fonts và các giá trị thiết kế mẫu; bọc CSS bằng `@scope (.admin-page)`, chuyển `:root`/`body` sang `:scope` để giới hạn font/reset/màu vào admin, kể cả sau khi CSS đã tải rồi đăng xuất. Thêm CSS cho cụm đăng xuất và xử lý thanh công cụ trên màn hình hẹp.
- `client/src/style.css`: giới hạn màu/nền/link/brand/heading/line-height trang cũ để tránh xung đột admin. Toàn bộ khối `.login-*`, bố cục đăng nhập và code túi 3D giữ nguyên.
- `client/tsconfig.json`: thêm `allowJs: true`, không bật checkJs.

## Bằng chứng đã thực hiện

Tại `D:\Website_3Q`, tất cả lệnh TypeScript dưới đây trả exit code 0:

```powershell
node_modules/.bin/tsc.cmd --noEmit -p client/tsconfig.json
node_modules/.bin/tsc.cmd --noEmit -p server/tsconfig.json
node_modules/.bin/tsc.cmd --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --strict server/src/tests/auth.test.ts server/src/tests/products.test.ts server/src/tests/authConfig.test.ts
```

- `git diff --check`: exit code 0; chỉ có cảnh báo LF/CRLF của Git.
- Đối chiếu bằng Python: khối CSS từ `.login-page` tới trước `.product-count` bằng nguyên bản HEAD. `git diff` không có thay đổi ở LoginPage, BirkinBag3D, `client/src/three/`, `client/src/assets/`.
- Tìm `userModel|prisma` trong authService, googleTokenVerifier, authController, authRoutes, requireAuth: không có kết quả.
- Impeccable `detect --json` trên các file UI liên quan: exit code 1, có phát hiện về thiết kế/CSS hiện có và bảng màu/cỡ chữ admin khác DESIGN.md của trang đăng nhập; không xem đây là kiểm tra đạt. Giữ thiết kế mẫu theo phạm vi được duyệt, không dùng detector để thiết kế lại.

## Giới hạn và lưu ý cho review

- Theo yêu cầu trực tiếp của Bảo, không chạy `npm run build` hoặc `npm test`. Các test đã cập nhật và qua kiểm tra kiểu, chưa xác nhận kết quả chạy.
- Chưa chạy server/API khi không có DATABASE_URL, chưa kiểm tra trình duyệt desktop/mobile hoặc vòng đăng nhập → admin → đăng xuất, chưa đăng nhập Google thật. Cần Claude kiểm tra các mục này; TypeScript không chứng minh giao diện hay hành vi runtime.
- CSS dùng `@scope`; cần kiểm tra trên trình duyệt mục tiêu. CSS admin nằm trong module lazy-load, không được import ở entrypoint hay App.tsx.
- Theo giả định đã duyệt, mọi email được phép đều có role ADMIN. Cookie userId cũ sẽ bị từ chối, người dùng cần đăng nhập lại. Allowlist được đọc từ env khi server khởi động; sau khi sửa danh sách trong `.env` cần khởi động lại server để áp dụng và thu hồi phiên.
- Không cài dependency, không sửa `server/.env`, không commit, không xóa file, không sửa code túi 3D. Không nối API dữ liệu thật cho admin.
- Trước phiên này workspace đã có thay đổi ở AGENTS.md, CLAUDE.md, client/index.html, admin mẫu, spec TASK-014 và hai migration ở trạng thái đã xóa. Codex giữ nguyên các thay đổi đó; các migration không bị xóa bởi phiên triển khai này.
