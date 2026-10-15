# TASK-009 — Kết quả triển khai đăng nhập MVC

- Dự án: web (`server/`, `client/`).
- Người phụ trách: Codex (triển khai, kiểm tra); Claude (review độc lập).
- Trạng thái: verified (Claude review: tasks/TASK-009-review.md).
- Ngày thực hiện: 2026-10-15.
- Hành động gần nhất: sửa L1 và ghi chú zod theo review, bổ sung test, kiểm tra lại ngày 2026-10-15; xem mục “Sửa theo review”.
- Bước tiếp theo: Claude review lại bản sửa; chạy lại build và toàn bộ Vitest trong môi trường cho phép khởi tạo tiến trình con. Chưa đạt đầy đủ tiêu chí nghiệm thu vì các lệnh này gặp `spawn EPERM`.

## Thay đổi

- `server/src/models/userModel.ts`: tra cứu email bằng Prisma, chỉ select id/email/role/passwordHash.
- `server/src/services/authService.ts`: so sánh bcrypt; chỉ trả id/email/role hoặc null.
- `server/src/controllers/authController.ts`: zod strict, email trim/lowercase/tối đa 191 ký tự; password 1–128 ký tự; lỗi 400/401 đúng thông điệp đặc tả; lỗi chuyển qua ApiError/errorHandler.
- `server/src/routes/authRoutes.ts`, `server/src/app.ts`: đăng ký `POST /api/auth/login` theo route → controller → service → model.
- `client/src/api/auth.ts`: gọi API, đọc error.message và có thông báo dự phòng.
- `client/src/pages/LoginPage.tsx`: form có label/autocomplete, khóa khi gửi, alert khi lỗi, thông báo email và link trang chủ khi thành công; nút Google disabled, ghi rõ chưa hỗ trợ.
- `client/src/App.tsx`, `client/src/components/Header.tsx`: route `/dang-nhap` và link đăng nhập.
- `client/src/style.css`: CSS mới với tiền tố `.login-`, nền tối/thẻ giữa, chiều rộng linh hoạt cho màn hình 360px, focus bàn phím.
- `server/src/tests/auth.test.ts`: 17 ca kiểm thử, model mock và bcrypt hash cost 4 tạo trong test; bao phủ thành công/không lộ hash, thông điệp lỗi chung, validation, chuẩn hóa email, biên mật khẩu, lỗi model.

Không thêm dependency, không đổi schema/migration. Không đọc hoặc chép bất cứ nội dung nào từ thư mục giao diện bên ngoài được nêu trong đặc tả. Chỉ chỉnh code trong server/client và file result này; không commit.

## Kết quả kiểm tra thực tế

Các lệnh dưới đây chạy tại `D:\Website_3Q` bằng PowerShell; dùng `npm.cmd` để gọi npm trên Windows.

- `npm.cmd run build` — exit 1. Server `tsc -p tsconfig.json` và client `tsc -b` qua; Vite dừng khi tải `client/vite.config.ts`, lỗi `Error: spawn EPERM` tại esbuild `ensureServiceIsRunning`. Chưa có bản build production client thành công.
- `npm.cmd test` — exit 1. Vitest 5.0.3 không khởi tạo được forks worker vì `spawn EPERM`; 3 lỗi, không test nào chạy. Không diễn giải là test đạt.
- `npm.cmd test -- --pool=threads` — exit 1; npm không chuyển tiếp pool xuống Vitest, cảnh báo Unknown cli config, vẫn lỗi forks như trên.
- `npm.cmd run test --workspace server -- --pool=threads` — exit 1. Đã dùng threads, nhưng cả 3 suite vẫn không load được do `spawn EPERM` ở Vite `optimizeSafeRealPathSync`; không test nào chạy.
- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` — đạt, không chẩn đoán lỗi.
- `node node_modules/typescript/bin/tsc -p client/tsconfig.json --noEmit` — đạt, không chẩn đoán lỗi.
- `node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck server/src/tests/auth.test.ts` — lần đầu tìm thấy kiểu null không được Supertest chấp nhận; đã sửa dữ liệu bảng test, lần cuối exit 0.
- Smoke test bằng script PowerShell here-string truyền vào `node --experimental-test-module-mocks --input-type=module` — exit 0. Dùng Node assert, bcrypt cost 4, Supertest, import `server/dist/app.js` và mock `server/dist/models/userModel.js`. Xác nhận 200 với body công khai chính xác và email đã trim/lowercase; 401 cho mật khẩu sai; 401 cùng body khi model trả null; 400 khi thêm role và không gọi model. Đây là API cục bộ với model giả lập, không thay thế bộ Vitest hoặc kiểm tra database thật. Node có cảnh báo API mock thử nghiệm/deprecation; không có dữ liệu mật khẩu/hash trong output.
- `git diff --check` — đạt; chỉ cảnh báo chuyển LF sang CRLF của Git.
- `rg -i -l --hidden --glob '!node_modules/**' a1radar server client` — không có kết quả khớp (rg exit 1 nghĩa là không tìm thấy).
- Đọc lại code: controller không gọi Prisma; service trả object công khai tường minh; code đăng nhập không ghi log mật khẩu/hash và lỗi nội bộ được errorHandler che bằng thông báo chung.

## Giới hạn và bàn giao

- Chưa được Claude review, không đặt verified.
- Chưa chạy được bộ Vitest và build Vite đầy đủ do hạn chế tiến trình của môi trường; cần chạy lại hai lệnh bắt buộc trước nghiệm thu.
- Chưa kiểm tra giao diện trong trình duyệt ở 360px hoặc luồng client/server/database đầy đủ; responsive hiện được kiểm tra qua code CSS và TypeScript.
- Chưa truy cập database/tài khoản thật hoặc dịch vụ ngoài máy. Không thay đổi dữ liệu ngoài máy.
- Theo phạm vi đặc tả, chưa có phiên cookie/JWT, OAuth, rate limit hoặc phân quyền; kết quả đăng nhập chỉ hiển thị trong trang hiện tại, không duy trì phiên khi tải lại.

## Sửa theo review

- Trạng thái: `ready_for_review`; đã xử lý yêu cầu sửa từ `TASK-009-review.md`, chưa được Claude kiểm tra độc lập bản sửa này. Bằng chứng bên trên là lịch sử triển khai trước review; kết quả dưới đây áp dụng cho lần sửa hiện tại.
- L1 — `server/src/services/authService.ts`: tạo hash giả một lần lúc nạp module bằng bcrypt, dùng mật khẩu giả cố định, không dùng bí mật/tài khoản thật. Luôn chờ đúng một `bcrypt.compare` sau khi tìm user, kể cả khi model trả `null`; chỉ trả thông tin công khai nếu có user và mật khẩu đúng. Hash giả được dùng lại qua các request.
- Lưu ý chênh lệch review: review ghi seed cost 10, nhưng `server/prisma/seed.ts:54` hiện dùng cost **12**. Hash giả dùng cost **12** để khớp seed thực tế; không sửa seed. Thay đổi này loại bỏ nhánh bỏ qua bcrypt, không khẳng định thời gian phản hồi bằng nhau tuyệt đối cho mọi tài khoản/hash khác cost.
- Ghi chú zod — `server/src/controllers/authController.ts`: thay `.email()` đã deprecated bằng `.pipe(z.email())`, giữ trim/lowercase/max(191) và strict body.
- Test — `server/src/tests/auth.test.ts`: thêm hai ca: model trả `null` vẫn gọi compare đúng một lần với hash bcrypt cost 12 và trả 401 chung; compare trả true nhưng không có user vẫn trả 401. Spy được restore sau mỗi test. Tổng số ca auth hiện là 19; chưa xác nhận đạt bằng Vitest.

### Kiểm tra lần sửa

Chạy tại `D:\Website_3Q` bằng PowerShell:

- `npm.cmd run build` — exit 1. Server tsc và client tsc qua; Vite không tải được config vì esbuild `spawn EPERM`. Build toàn bộ **chưa đạt**.
- `npm.cmd test` — exit 1. Vitest 5.0.3 gặp `spawn EPERM` khi tạo forks worker cho cả 3 suite, sau đó timeout dừng worker. **Không test nào chạy; không coi là test đạt.**
- `node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck server/src/tests/auth.test.ts` — exit 0, không lỗi kiểu dữ liệu.
- Smoke test Node assert qua PowerShell here-string, `node --experimental-test-module-mocks --input-type=module`, import service đã build và mock model — exit 0. Dùng bcrypt thật, xác nhận: user không tồn tại vẫn compare đúng một lần với cost 12; hai lần gọi dùng cùng hash giả; mật khẩu khớp hash giả vẫn trả null; user có thật trong fixture trả đúng object công khai khi đúng mật khẩu và null khi sai. Node cảnh báo API mock thử nghiệm/deprecation. Đây là kiểm tra service cục bộ với model giả lập, **không thay thế Vitest hoặc kiểm tra database thật**.
- `git diff --check` — exit 0, chỉ cảnh báo LF/CRLF ở các file đã có thay đổi từ trước.

Lần sửa này chỉ chỉnh ba file source/test trong `server/` nêu trên và file result này; không sửa client, schema, dependency hay dữ liệu thật; không commit. Cần Claude review lại và chạy Vitest/build thành công trước khi đặt `verified`.
