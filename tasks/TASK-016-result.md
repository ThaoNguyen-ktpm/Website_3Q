# TASK-016 — Ba vai trò và phân quyền tùy chỉnh

- Dự án: web.
- Người phụ trách: Codex (triển khai); Claude (migration, generate, seed, review độc lập).
- Trạng thái: ready_for_review.
- Hành động gần nhất: hoàn tất code, bổ sung test, self-check giả lập đạt; đã ghi bằng chứng và giới hạn bên dưới.
- Bước tiếp theo: Claude chuyển dữ liệu vai trò cũ, migrate/generate/seed rồi chạy build/test và review độc lập.

## Thay đổi chính

- Ba vai trò ADMIN / MANAGER / STAFF, mặc định STAFF; ADMIN luôn toàn quyền trong code.
- Schema thêm RolePermission; model thay quyền trong transaction; service kiểm tra Admin, role và body strict, khóa hợp lệ, không trùng.
- GET /api/staff/roles trả roles + catalog; PUT /api/staff/roles/:role/permissions chỉ Admin.
- publicUser đọc quyền bất đồng bộ từ DB mỗi lần đăng nhập/đọc phiên; middleware nhận quyền hiện tại.
- Bảo vệ gán/gỡ ADMIN, tự đổi vai trò/tạm ngưng và LAST_ADMIN; seed code chuyển sang ADMIN và khởi tạo quyền mặc định khi chưa có dữ liệu.
- Client có panel ma trận checkbox, khóa cột Admin, chỉ lưu role thay đổi, tải lại hồ sơ sau lưu; drawer mặc định STAFF và dùng quyền từ API.

## Chi tiết cần Claude biết

- Theo schema được giao, không thể phân biệt vai trò chưa cấu hình với vai trò đã lưu danh sách rỗng nếu đều không có dòng DB. Model lưu marker nội bộ `__EMPTY__` cho danh sách rỗng. Marker không nằm trong catalog, không được nhận qua API và không được trả như quyền. Seed thấy marker sẽ giữ nguyên cấu hình rỗng.
- Workspace đã có nhiều thay đổi và file migration bị xóa từ trước task. Codex giữ nguyên các thay đổi đó, không khôi phục hoặc xóa file.

## File liên quan

- `server/prisma/schema.prisma`, `server/prisma/seed.ts`.
- `server/src/config/permissions.ts`, `server/src/models/{staffModel,rolePermissionModel}.ts`, `server/src/services/{staffService,permissionService}.ts`.
- `server/src/controllers/staffController.ts`, `server/src/routes/staffRoutes.ts`.
- `server/src/tests/{auth,staff,products,rolePermissionModel}.test.ts`.
- `client/src/api/staff.ts`, `client/src/pages/AdminPage.tsx`, `client/src/admin/views/App.jsx`, `client/src/admin/styles.css`.
- `client/task-015-preview.html`: cập nhật fixture đang có để import danh mục mới, mô phỏng PUT và refresh callback; mọi fetch vẫn bị chặn ở fixture, không chuyển tiếp API thật.
- `tasks/TASK-016-selfcheck.mjs`: kiểm tra bổ sung bằng source TypeScript và Prisma giả lập, chạy Node 24 với TypeScript đã cài; không kết nối DB/Google.
- `authService`, `requireAuth`, `requirePermission` tiếp tục dùng chuỗi gọi sẵn có: `publicUser` nay bất đồng bộ và được các hàm async hiện tại trả/await đầy đủ; không cần sửa thêm các file này.

## Kiểm tra thực tế

- `node node_modules/typescript/bin/tsc -b client`: **đạt**, exit 0.
- `node tasks/TASK-016-selfcheck.mjs`: **đạt**, exit 0. Gọi API Express thật trong process với Supertest; thay toàn bộ truy cập Prisma bằng dữ liệu thử. Kiểm tra mặc định, 401/403/400, body strict, quyền trùng/lạ, quyền DB có hiệu lực với cùng cookie, quyền rỗng không fallback, ADMIN đủ 11 quyền, cấp staff.manage cho Manager, chặn gán/gỡ ADMIN và tự tạm ngưng, LAST_ADMIN, lỗi lưu và giao dịch giả lập rollback. Đây không phải bằng chứng transaction/rollback trên MySQL thật.
- `npm.cmd run build`: **chưa đạt**, exit 1. Server tsc báo 11 lỗi do Prisma client cũ: thiếu `rolePermission`, enum StaffRole còn OWNER/SALES nên chưa nhận ADMIN/STAFF. Không chạy generate theo yêu cầu. Lỗi implicit-any phụ thuộc delegate cũ đã được loại bằng kiểu trả về rõ ràng của model; chưa thể kết luận server tsc sạch trước generate.
- `npm.cmd run build --workspace client`: tsc đạt; Vite **không build được**, exit 1 vì `spawn EPERM` ở esbuild khi nạp config.
- `npm.cmd test`: **không chạy được test**, Vitest bị `spawn EPERM` khi tạo forks worker; không có số test đạt để báo cáo.
- `npm.cmd run test --workspace server -- --pool=threads`: thử pool threads; vẫn **không chạy được test**, `spawn EPERM` ở Vite Windows realpath (`net use`). Không sửa cấu hình dự án để né giới hạn môi trường.
- `git diff --check`: **đạt**, chỉ có cảnh báo chuẩn hóa LF/CRLF ở file sẵn có.
- Impeccable detector đã chạy một lượt trên UI thay đổi; báo font/màu/cỡ chữ admin sẵn có không khớp DESIGN.md của trang đăng nhập. Giữ design admin theo đặc tả, không sửa login hoặc tài liệu design ngoài phạm vi.
- Thử mở trang mô phỏng bằng browser: IAB không có; Chrome bị cổng phê duyệt tự động từ chối truy cập `http://localhost:5173` (origin approval không được cấp). Không lách qua bề mặt khác. **Chưa xác minh giao diện bằng trình duyệt**, gồm desktop/mobile và tương tác checkbox/lưu.

## Bàn giao và giới hạn

- Code và test đã viết xong; **chưa được Claude kiểm tra độc lập**, giữ `ready_for_review`.
- Không chạy prisma migrate/generate/seed, không cài dependency, không sửa server/.env, không commit; không xóa file, không sửa túi 3D hoặc rule .login-*.
- Claude cần xử lý dữ liệu OWNER → ADMIN và xác định chuyển đổi các role cũ còn lại nếu DB có SALES/WAREHOUSE/ACCOUNTANT, trước khi thay enum; Codex không thao tác DB.
- Chưa xác minh DB thật, Google thật, tính đồng thời trên MySQL, build đầy đủ hoặc toàn bộ Vitest. Self-check không thay thế các kiểm tra này.
- UI lưu từng vai trò bằng PUT riêng; nếu role đầu lưu thành công nhưng role sau lỗi, role đã lưu được cập nhật trong state và role còn lỗi vẫn có thay đổi để thử lại. Không tuyên bố hai PUT là một transaction chung.
