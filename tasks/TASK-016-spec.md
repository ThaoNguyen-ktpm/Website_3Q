# TASK-016 — 3 vai trò; Admin tùy chỉnh quyền của vai trò

- Dự án: web (`server/`, `client/`). Nối tiếp TASK-015.
- Người phụ trách: Claude (đặc tả, review, migration DB), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16: "muốn 3 role thôi: admin, quản lý, nhân viên; quyền này thằng admin có thể custom lại". Bảo đã giao toàn quyền task.
- Bước tiếp theo: Codex sửa schema + code + test, ghi `tasks/TASK-016-result.md`. KHÔNG chạy prisma migrate/generate/seed (Claude làm, có chuyển dữ liệu OWNER → ADMIN).

## Vai trò
`enum StaffRole { ADMIN MANAGER STAFF }` — nhãn: Admin / Quản lý / Nhân viên. Mặc định khi thêm nhân viên: `STAFF`.

## Quyền
Danh mục quyền giữ nguyên khóa và nhãn hiện có trong `server/src/config/permissions.ts` (`dashboard.view`, `reports.export`, `products.view`, `products.edit`, `orders.view`, `orders.edit`, `customers.view`, `customers.edit`, `staff.view`, `staff.manage`, `settings.manage`).
- `ADMIN`: luôn có tất cả quyền, cố định trong code, không lưu DB, không chỉnh được (tránh tự khóa).
- `MANAGER`, `STAFF`: quyền lưu trong DB, Admin chỉnh được. Mặc định khi chưa có dữ liệu:
  - MANAGER: tất cả trừ `staff.manage`, `settings.manage`.
  - STAFF: `dashboard.view`, `products.view`, `orders.view`, `orders.edit`, `customers.view`, `customers.edit`.

## Schema
```prisma
model RolePermission {
  role       StaffRole
  permission String    @db.VarChar(64)
  createdAt  DateTime  @default(now())
  @@id([role, permission])
}
```
`Staff.role` default `STAFF`.

## Server
- `models/rolePermissionModel.ts`: đọc quyền theo vai trò; thay toàn bộ quyền của một vai trò trong transaction.
- `services/permissionService.ts`: `permissionsFor(role)` (ADMIN → tất cả; khác → DB, nếu vai trò chưa có dòng nào thì dùng mặc định ở trên); `listRoles()`; `setRolePermissions(actor, role, permissions)`.
- Quy tắc: chỉ `actor.role === 'ADMIN'` được sửa quyền (403 `FORBIDDEN`); không sửa `ADMIN` (400 `VALIDATION_ERROR`); khóa quyền phải nằm trong danh mục, không trùng (400); cho phép danh sách rỗng.
- API: `GET /api/staff/roles` (`staff.view`) trả `{ roles: [{ role, label, editable, permissions: [{ key, label }] }], catalog: [{ key, label }] }`. `PUT /api/staff/roles/:role/permissions` body strict `{ permissions: string[] }` (chỉ ADMIN). Trả vai trò đã cập nhật.
- Quyền người dùng (`/api/auth/me`, `/google`, `response.locals.user`, `requirePermission`) đọc từ `permissionsFor(role)` mỗi lần đọc phiên → chỉnh quyền có hiệu lực ngay ở request kế tiếp.
- Quy tắc nhân viên (`staffService.ts`): đổi OWNER → ADMIN ở mọi chỗ: chỉ ADMIN gán/gỡ vai trò ADMIN; không tự đổi vai trò/tự tạm ngưng; luôn còn ≥1 ADMIN ACTIVE (`LAST_ADMIN`, "Hệ thống phải còn ít nhất một Admin đang hoạt động."). Quyền thêm/sửa nhân viên vẫn theo `staff.manage` (Admin có thể cấp cho Quản lý).
- `prisma/seed.ts`: tạo/cập nhật `ADMIN` ACTIVE cho email trong `GOOGLE_ALLOWED_EMAILS` (thay OWNER); tạo quyền mặc định MANAGER/STAFF chỉ khi vai trò đó chưa có dòng nào.
- Tests: cập nhật `auth.test.ts`, `staff.test.ts`; thêm test quyền: không phải ADMIN sửa quyền → 403; sửa ADMIN → 400; khóa lạ → 400; sửa thành công thì `/me` của nhân viên vai trò đó thấy quyền mới; `requirePermission` dùng quyền DB.

## Client (giữ design admin: PanelHeading, bảng, Badge, `.button`, toast)
- Select vai trò trong drawer: 3 vai trò; ẩn `ADMIN` nếu người dùng không phải ADMIN. Danh sách quyền xem trước lấy từ `/api/staff/roles`.
- Trang Nhân viên: thêm panel "Phân quyền theo vai trò" bên dưới bảng nhân viên, chỉ hiện khi người dùng là ADMIN. Bảng: hàng = quyền (nhãn tiếng Việt), cột = Admin / Quản lý / Nhân viên; ô là checkbox; cột Admin luôn tick và khóa (ghi chú "Admin luôn có toàn quyền"). Nút "Lưu phân quyền" (chỉ bật khi có thay đổi) gọi PUT cho vai trò đã đổi; thông báo thành công/lỗi; sau khi lưu, tải lại hồ sơ người dùng để menu cập nhật nếu cần.
- Nhãn vai trò hiển thị ở thanh trên, bảng nhân viên theo 3 nhãn mới.

## Tiêu chí nghiệm thu
`tsc` sạch, `npm run build`, `npm test` đạt (sau khi Claude generate). Không sửa code túi 3D, `.login-*`, không cài dependency, không commit, không xóa file.
