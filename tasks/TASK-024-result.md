# TASK-024 — Admin chính cố định trong controller

- Dự án: web (`server/`, `client/`).
- Người triển khai: Codex. Người review độc lập: Claude (chưa review).
- Trạng thái: `ready_for_review` — code hoàn tất; suite chưa xanh toàn bộ do 3 assertion cũ không chấp nhận trường response mới.
- Hành động gần nhất: triển khai chặn sửa Admin chính, thêm cờ API/giao diện và kiểm tra cục bộ ngày 2026-10-16.
- Bước tiếp theo: Claude review code, đối chiếu xung đột hợp đồng response của 3 test cũ; chạy build/test mặc định trong môi trường cho phép tạo tiến trình con. Chưa đặt `verified`.

## Thay đổi

- `server/src/config/primaryAdmin.ts`: khai báo duy nhất `PRIMARY_ADMIN_EMAIL = 'nvthao.12a5.20@gmail.com'`, có comment yêu cầu của Bảo; helper nhận diện sau trim và chuyển chữ thường. Không đọc DB hoặc biến môi trường để xác định Admin chính.
- `server/src/services/staffService.ts`: thêm `getById` chỉ đọc, kiểm tra ID, chỉ trả ID/email hoặc null. Không sửa logic update, luật tự sửa, giao dịch hoặc audit hiện có.
- `server/src/controllers/staffController.ts`: đọc đích qua service trước update; người khác sửa Admin chính nhận 403 `FORBIDDEN`, message `Không thể thay đổi tài khoản Admin chính.`, không gọi service update, transaction, model update hay ghi audit. Đích không tồn tại vẫn để update service xử lý 404; ID không hợp lệ trả 400.
- Danh sách nhân viên có `isPrimaryAdmin` tính ở controller, giữ các trường khác. Response create/update cũng có cờ để dòng vừa tạo/sửa vẫn đủ thông tin sau callback cập nhật state của bảng.
- `server/src/controllers/authController.ts`: `/api/auth/me` có cờ. Response Google login cũng có cùng cờ vì `LoginPage` đưa trực tiếp user từ login vào state; nếu chỉ thêm cho `/me`, Admin chính vừa đăng nhập sẽ chưa có cờ cho tới khi tải lại trang.
- `client/src/api/auth.ts`, `client/src/api/staff.ts`: bổ sung kiểu boolean cho cờ response; không đưa cờ vào kiểu dữ liệu ghi của StaffDraft.
- `client/src/admin/views/App.jsx`: dùng class badge hiện có cho nhãn “Admin chính”, ẩn nút Sửa của dòng đó khi user không phải Admin chính; vẫn giữ ô bảng. Giữ xử lý lỗi server trong drawer.
- Thêm `server/src/tests/primaryAdmin.test.ts` (25 test) và `tasks/TASK-024-ui-selfcheck.mjs`. Không sửa, xóa hoặc nới bất kỳ test cũ nào.

## Kiểm tra thực tế

Các lệnh dưới đây chạy tại `D:\Website_3Q`, PowerShell, trừ khi ghi khác.

1. `npm.cmd run build`: server tsc và client tsc đạt; Vite không hoàn tất vì `spawn EPERM` khi khởi tạo esbuild. Exit 1; không ghi nhận production build thành công.
2. `npm.cmd test`: không khởi tạo được forks worker (`spawn EPERM`), không chạy test. Đổi sang threads trực tiếp tại server cũng gặp EPERM khi Vite gọi realpath Windows. Không đổi cấu hình mặc định để né lỗi.
3. `node node_modules/vitest/vitest.mjs run src/tests/primaryAdmin.test.ts --config tasks/TASK-018-vitest.config.ts --configLoader native`: **25/25 test mới đạt**, exit 0. Dùng runner dự phòng có sẵn, không sửa runner hoặc test cũ.
4. `node node_modules/vitest/vitest.mjs run --config tasks/TASK-018-vitest.config.ts --configLoader native`: **220 đạt, 3 thất bại, tổng 223 test; 8 file đạt và 1 file thất bại**, exit 1. Chi tiết bên dưới.
5. `node tasks/TASK-024-ui-selfcheck.mjs`: PASS, exit 0. Kết xuất component và gọi handler với fixtures: nhãn đúng tiếng Việt; quyền thấy nút Sửa cho hai loại user; nhãn còn sau cập nhật dòng; module API truyền đúng message 403 vào drawer, drawer không đóng và nút lưu được bật lại sau lỗi. Đây là kiểm tra cục bộ với hooks/API giả lập trong test, không phải trình duyệt hoặc API thật.
6. `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit`: đạt, exit 0.
7. `node node_modules/typescript/bin/tsc -b client/tsconfig.json`: đạt, exit 0.
8. `node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --strict server/src/tests/primaryAdmin.test.ts`: đạt, exit 0. Kiểm tra riêng test mới vì build server loại thư mục tests.
9. `C:/Users/Admin/.codex/skills/impeccable/scripts/impeccable.cmd detect --json client/src/admin/views/App.jsx`: trả `[]`. Detector chạy trước lần sửa lỗi mã hóa và điều kiện JSX; xác nhận cuối bằng selfcheck component và TypeScript ở trên.
10. `git diff --check -- server/src/controllers/authController.ts client/src/api/auth.ts`: đạt. `git diff --check` toàn workspace báo dòng trống cuối file ở `client/src/style.css:105`; file này có thay đổi sẵn từ trước, không thuộc TASK-024 và không sửa trong task này.

Runner dự phòng có cảnh báo `MODULE_TYPELESS_PACKAGE_JSON`; không sửa package.json chỉ để tắt cảnh báo. Dòng stack assertion từ runner transpile có thể lệch dòng nguồn; nhận diện test bằng tên bên dưới.

## Ba test cũ thất bại — giữ nguyên theo yêu cầu Bảo

Đều ở `server/src/tests/auth.test.ts`, dùng `toEqual({ user: publicUser })` với object cũ không có `isPrimaryAdmin`:

- `Google login > verifies audience and returns a signed seven-day httpOnly cookie and safe user` (bao gồm cả login và đọc `/me`).
- `Google login > binds Google subject and updates last login through the staff model`.
- `Sessions > reads a valid signed session`.

Diff thực tế của các assertion thất bại chỉ thêm `isPrimaryAdmin: false` vào user. Đây là thay đổi hợp đồng response có chủ đích; test mới xác nhận cả true/false, login và `/me`. Không thể đồng thời thêm trường boolean theo spec và giữ nguyên kết quả so sánh toàn object cũ. Không dùng điều kiện test, giấu trường cho một số email, bỏ qua test hoặc sửa/nới test cũ để suite xanh.

## Phạm vi test mới và giới hạn

- Admin khác sửa họ tên, điện thoại, vai trò, trạng thái, quyền hoặc payload kết hợp của Admin chính: 403 đúng message, không gọi service update/model write/transaction/audit.
- Admin chính tự sửa tên/điện thoại: 200; tự hạ quyền, khóa tài khoản hoặc đổi quyền: service vẫn trả 403.
- Cả hai Admin sửa nhân viên thường: 200.
- Email đích/người thao tác có chữ hoa và khoảng trắng vẫn nhận diện đúng; email khác/thiếu không được nhận nhầm.
- Đích thiếu: 404 qua update service; lỗi đọc đích: 500 và không ghi.
- Cờ danh sách và `/me` đúng; danh sách không lộ googleSub. Google login trả cờ ngay để giao diện dùng được trong phiên mới.
- Không kiểm tra Google Sign-In thật, thao tác tài khoản thật, giao diện trình duyệt desktop/mobile hay triển khai thật. Chưa xác minh production bundle do EPERM.
- Không cài package, không sửa dependency/lockfile, DB/schema/migration/seed/`.env`, không commit. Các thay đổi có sẵn tại những vùng đó trong workspace không thuộc TASK-024.
- Không thêm cơ chế tự nâng role theo email: quyền hiện có vẫn do hệ thống phân quyền xử lý. Chưa có review độc lập của Claude.
