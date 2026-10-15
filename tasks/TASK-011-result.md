# TASK-011 — Bắt đăng nhập trước khi vào web

- Dự án: web (`server/`, `client/`).
- Người phụ trách triển khai: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai theo spec đã duyệt; chạy build/test ngày 2026-10-15 và ghi nhận lỗi môi trường `spawn EPERM`.
- Bước tiếp theo: Claude kiểm tra độc lập, chạy lại build/test trong môi trường cho phép tạo tiến trình, kiểm tra luồng trên trình duyệt.
- Code đã hoàn tất; chưa được Claude kiểm tra độc lập cho TASK-011. Build/test toàn bộ chưa đạt.

## Thay đổi

- `server/src/middlewares/requireAuth.ts` (mới): đọc `request.signedCookies.sid` qua `readSession`; phiên hợp lệ gắn user công khai vào `response.locals.user` rồi `next()`. Phiên không hợp lệ trả 401 `UNAUTHENTICATED`, thông báo `Bạn chưa đăng nhập.`; chuyển lỗi qua error handler. Không gọi Prisma trực tiếp.
- `server/src/app.ts`: áp middleware cho toàn bộ `/api/products`; giữ `/api/health` và `/api/auth/*` ngoài middleware. Thiếu `SESSION_SECRET` bị chặn bởi `readSession` hiện có.
- `client/src/components/RequireAuth.tsx` (mới): chờ kiểm tra phiên bằng thông báo `Đang kiểm tra đăng nhập…`; chưa có user thì chuyển `/dang-nhap` với `replace` và `state.from` gồm pathname, query, hash; có user mới render route con.
- `client/src/App.tsx`: route `/dang-nhap` riêng; trang chủ, trang 404 và Header nằm sau cùng một guard, không render nội dung bảo vệ trong lúc kiểm tra phiên.
- `client/src/pages/LoginPage.tsx`: cả đăng nhập thành công và user đã đăng nhập đều chuyển tới cùng đích `from` nội bộ, mặc định `/`. Kiểm tra kiểu string, tiền tố `/`, loại `//`, dấu gạch chéo ngược và đích chính trang đăng nhập để tránh chuyển ra ngoài/vòng lặp. Khi đang kiểm tra phiên chỉ render thông báo chờ.
- `client/src/hooks/useAuth.ts`: thêm callback ổn định `expireSession` để xóa user khi API trả 401; `signOut` báo thành công/thất bại cho Header.
- `client/src/components/Header.tsx`: sau khi đăng xuất thành công, chuyển `/dang-nhap` bằng `replace`; giữ thông báo lỗi nếu logout thất bại.
- `client/src/api/products.ts`: gửi cookie với `credentials: 'include'`; phân biệt 401 bằng `UnauthenticatedError`.
- `client/src/hooks/useProducts.ts`, `client/src/pages/HomePage.tsx`: nối xử lý 401 tới `expireSession` để guard chuyển trang; không hiển thị lỗi tải sản phẩm cho 401. Bỏ qua lỗi của request đã hủy.
- `server/src/tests/products.test.ts`: cập nhật test dữ liệu hiện có dùng cookie ký hợp lệ; thêm các trường hợp không cookie, ký sai, không ký, quá hạn, thiếu secret, user đã xóa, ranh giới 7 ngày và lỗi đọc user. Kiểm tra model sản phẩm không được gọi khi bị chặn. Dùng mock user/model và secret fixture, không kết nối database hay Google.

## Kiểm tra thực tế

Chạy tại `D:\Website_3Q`, dùng `npm.cmd` trong PowerShell:

1. `npm.cmd run build`: **không đạt**, exit code 1.
   - `server`: `tsc -p tsconfig.json` hoàn tất.
   - `client`: `tsc -b` hoàn tất, sau đó `vite build` thất bại khi nạp `client/vite.config.ts`: `Error: spawn EPERM`, tại `esbuild` → `ensureServiceIsRunning` → `bundleConfigFile`.
   - Không coi bước TypeScript thành bằng chứng build toàn bộ đạt.
2. `npm.cmd test`: **không đạt**, exit code 1.
   - Vitest 5.0.3 không khởi chạy được fork worker cho cả 4 file `auth.test.ts`, `authConfig.test.ts`, `app.test.ts`, `products.test.ts` do `spawn EPERM` (`errno: -4048`).
   - Kết quả: `Test Files no tests`, `Tests no tests`, `Errors 4 errors`; tiếp theo timeout đóng worker. Không có ca kiểm thử runtime nào được xác minh đạt.
3. Kiểm tra TypeScript server gồm cả test bằng TypeScript API có sẵn: **đạt**, exit code 0, thông báo `Server TypeScript including tests: passed (no emit, no runtime tests).`
   - Chạy `node --input-type=module -e` đọc `server/tsconfig.json` bằng `ts.readConfigFile`/`ts.parseJsonConfigFileContent`, tạo program từ mọi `server/src/**/*.ts` bằng `ts.sys.readDirectory`, giữ compiler options và đặt `noEmit: true`, lấy `ts.getPreEmitDiagnostics`.
   - Đây chỉ là kiểm tra kiểu; không thay thế Vitest.
4. `git diff --check`: **đạt**, exit code 0; Git có cảnh báo chuẩn hóa LF/CRLF, không báo lỗi whitespace.

## Giả định và giới hạn

- Spec nhắc test lọc danh mục và validate sản phẩm; checkout hiện chỉ có một test sản phẩm trả tên/giá/danh mục, controller không triển khai lọc/validate. Giữ nguyên hành vi sản phẩm hiện có, không thêm tính năng ngoài phạm vi. Test `/api/health` không cookie và các test auth hiện có được giữ nguyên.
- Chưa xác minh luồng trình duyệt: chờ phiên, truy cập trực tiếp/404, giữ query/hash, đăng nhập trở lại `from`, đăng xuất và hết phiên. Chưa thử đăng nhập Google thật hoặc truy vấn MySQL thật.
- Cần Claude chạy lại `npm run build`, `npm test` và kiểm tra các luồng trên trước khi kết luận `verified`.
- Không cài dependency, sửa `server/.env`, commit, xóa file hoặc thay đổi ngoài `server/`, `client/` và báo cáo này. Giữ nguyên các thay đổi/staging có sẵn của TASK-010 và phần khác trong workspace.
