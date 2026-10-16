# TASK-017 — Phân quyền riêng cho từng nhân viên

- Dự án: web.
- Người phụ trách: Codex (triển khai), Claude (review và migration DB).
- Trạng thái: ready_for_review.
- Hành động gần nhất: hoàn tất code, cập nhật test và chạy kiểm tra mô phỏng server/UI; client TypeScript sạch.
- Bước tiếp theo: Claude review độc lập, migrate/generate DB rồi chạy lại build/test và kiểm tra giao diện đã đăng nhập.

## Giới hạn đã thống nhất
- Không chạy Prisma migrate/generate/seed; Claude thực hiện. Lỗi TypeScript do Prisma client cũ sẽ ghi riêng.
- Không cài dependency, không sửa server/.env, không commit, không sửa code túi 3D hoặc rule .login-*.
- Chỉ kiểm tra cục bộ/mô phỏng; chưa có kết quả review độc lập của Claude.

## Thay đổi
- Thêm `Staff.customPermissions`, quan hệ `permissions` và model `StaffPermission` đúng đặc tả; chưa tạo migration hay cập nhật DB/client Prisma.
- Mọi truy vấn Staff đọc kèm quyền riêng. `publicUser` dùng `permissionsFor(staff)` nên `/google`, `/me`, `readSession` và middleware đọc quyền mới ở mỗi request. Admin luôn toàn quyền, custom rỗng giữ nguyên rỗng, còn lại dùng mẫu vai trò.
- POST/PATCH nhận `permissions` strict, kiểm tra khóa hợp lệ và không trùng. Mảng trùng mẫu được chuẩn hóa về mặc định; null khôi phục mặc định; đổi vai trò không gửi quyền xóa tùy chỉnh. PATCH không gửi quyền và không đổi vai trò giữ tùy chỉnh.
- Không tự sửa quyền; người thao tác không được cấp quyền ngoài bộ quyền mình có, kể cả cấp ngầm qua mẫu khi tạo/reset vai trò. Giữ kiểm tra `staff.manage`, gán Admin, tự đổi vai trò/tạm ngưng và Admin cuối cùng.
- Lưu cờ và thay toàn bộ quan hệ bằng nested Prisma write trong transaction Serializable; giữ retry P2034. Không dùng marker cho bộ quyền riêng rỗng.
- Bỏ route PUT, hàm sửa quyền chung trong controller/service/model/API client và panel theo vai trò. GET roles cùng model đọc mẫu vẫn giữ; thay test ghi mẫu cũ bằng test đọc mẫu trong cùng file, không xóa file.
- Drawer dùng checkbox nhãn tiếng Việt, tick quyền hiệu lực, chọn vai trò/reset thì tick mẫu; khóa Admin, chính mình và quyền người thao tác không sở hữu. Khi lưu hồ sơ chính mình, bỏ trường permissions để vẫn sửa tên/số điện thoại được. Có badge “Tùy chỉnh”.
- Bỏ callback refresh riêng của panel cũ tại AdminPage; không thay luồng đăng nhập.

## File liên quan
- `server/prisma/schema.prisma`.
- `server/src/models/{staffModel,rolePermissionModel}.ts`.
- `server/src/services/{permissionService,staffService}.ts`.
- `server/src/controllers/staffController.ts`, `server/src/routes/staffRoutes.ts`.
- `server/src/tests/{staff,auth,rolePermissionModel}.test.ts`.
- `client/src/api/staff.ts`, `client/src/admin/views/App.jsx`, `client/src/admin/styles.css`, `client/src/pages/AdminPage.tsx`.
- `tasks/TASK-017-selfcheck.mjs`, `tasks/TASK-017-ui-selfcheck.mjs`, báo cáo này.

## Lệnh kiểm tra và kết quả thực tế
- `node tasks/TASK-017-selfcheck.mjs`: **PASS**. Chạy source API/service/model bằng TypeScript loader tại chỗ với Prisma giả. Bao phủ tạo custom/mặc định/null/mảng trùng mẫu/bộ rỗng; đổi vai trò reset; sửa thông tin giữ quyền; cùng cookie thấy quyền mới ngay ở `/me` và `requirePermission`; nhân viên khác không đổi; tự sửa quyền và cấp vượt quyền bị 403; Admin toàn quyền; dữ liệu lạ/trùng/extra bị 400; quy tắc Admin; lỗi ghi trả 500; route PUT cũ 404. Không kết nối DB/Google.
- `node tasks/TASK-017-ui-selfcheck.mjs`: **PASS**. Kiểm tra source StaffForm bằng React element và hook/API giả: tick quyền hiệu lực/mẫu, toggle và payload lưu, đổi vai trò, nút mặc định, khóa Admin/chính mình/quyền không sở hữu, không gửi quyền khi sửa chính mình, nhãn tiếng Việt và bỏ panel cũ. Có kết xuất HTML tĩnh, không phải test trình duyệt.
- `node node_modules/typescript/bin/tsc -p client/tsconfig.json --noEmit`: **PASS**.
- `npm.cmd run build`: **FAIL dự kiến ở server vì Prisma client cũ**: TS2322 (`include.permissions` chưa tồn tại), TS2345 (Staff chưa có customPermissions), TS2353 (StaffCreateInput chưa có permissions). Không chạy generate theo yêu cầu.
- `npm.cmd run build --workspace client`: TypeScript đạt; **Vite bị chặn** khi khởi động esbuild (`spawn EPERM`).
- `npm.cmd test`: **không chạy được test** vì worker forks bị `spawn EPERM`. Thử `node ../node_modules/vitest/vitest.mjs run --pool=threads` trong server cũng bị Vite `windowsSafeRealPathSync` chặn spawn EPERM. Hai selfcheck trên là bằng chứng bổ sung, không thay cho tuyên bố Vitest đạt.
- `git diff --check`: **PASS**, chỉ có cảnh báo chuyển LF/CRLF của các file có sẵn.
- Impeccable detect đã chạy; báo style admin hiện có khác DESIGN.md của trang đăng nhập. Giữ thiết kế admin theo đặc tả, không sửa login hay mở rộng phạm vi chỉnh style.

## Giới hạn và bàn giao
- Code hoàn tất, **chưa được Claude kiểm tra độc lập**; không ghi verified.
- Chưa xác minh với Prisma client mới/DB thật, chưa kiểm chứng transaction/cascade trên MySQL hay thao tác drawer trong trình duyệt với phiên Google thật.
- Claude cần migrate/generate rồi chạy lại `npm.cmd run build`, `npm.cmd test` trong môi trường cho phép tạo tiến trình. Các selfcheck chỉ mô phỏng DB và kiểm tra component.
- Không chạy migrate/generate/seed, không cài dependency, không sửa server/.env, không commit, không sửa code túi 3D/rule .login-*; giữ thay đổi người dùng có sẵn.
