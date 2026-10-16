# TASK-017 — Phân quyền riêng cho từng nhân viên

- Dự án: web. Nối tiếp TASK-016.
- Người phụ trách: Claude (đặc tả, review, migration DB), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16: "sửa quyền cho từng người chứ không phải sửa hết" (ảnh drawer Sửa nhân viên). Bảo đã giao toàn quyền task.
- Bước tiếp theo: Codex sửa schema + code + test, ghi `tasks/TASK-017-result.md` sớm. KHÔNG chạy prisma migrate/generate/seed.

## Mô hình
- Vai trò (ADMIN / MANAGER / STAFF) giữ nguyên; quyền của vai trò (`RolePermission`, đã seed) là **mẫu mặc định**.
- Mỗi nhân viên có thể có bộ quyền riêng:
```prisma
model Staff {
  // thêm:
  customPermissions Boolean           @default(false)
  permissions       StaffPermission[]
}
model StaffPermission {
  staffId    Int
  permission String   @db.VarChar(64)
  createdAt  DateTime @default(now())
  staff      Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  @@id([staffId, permission])
}
```
- Quyền hiệu lực: `ADMIN` → tất cả (luôn, bỏ qua tùy chỉnh); `customPermissions = true` → các dòng `StaffPermission` (có thể rỗng); ngược lại → quyền của vai trò.
- Đọc lại mỗi request (như hiện tại) → đổi quyền có hiệu lực ngay.

## Server
- `staffModel`: đọc/ghi `customPermissions` + thay toàn bộ `StaffPermission` của một nhân viên trong cùng transaction với cập nhật Staff.
- `permissionService.permissionsFor(staff)` theo quy tắc trên (thay vì chỉ theo role). Mọi nơi dùng (`readSession`, `/me`, `/google`, `requirePermission`) đi qua đây.
- `POST /api/staff` và `PATCH /api/staff/:id`: thêm trường tùy chọn `permissions: string[] | null` (zod strict, khóa thuộc danh mục, không trùng). `null` hoặc không gửi khi tạo = dùng mẫu vai trò. Nếu mảng gửi lên **trùng đúng** quyền mẫu của vai trò → lưu `customPermissions=false`, xóa dòng riêng. Khác → `customPermissions=true` + lưu dòng.
- Đổi vai trò mà không gửi `permissions` → trở về mẫu của vai trò mới (xóa tùy chỉnh).
- Quy tắc (403 `FORBIDDEN` trừ khi ghi khác):
  - Cần `staff.manage`.
  - Không sửa quyền của chính mình.
  - Không cấp quyền mà người thao tác không có (ADMIN có tất cả).
  - Nhân viên vai trò ADMIN: bỏ qua `permissions` (luôn toàn quyền), `customPermissions=false`.
  - Giữ các quy tắc cũ (chỉ ADMIN gán ADMIN, không tự đổi vai trò/tự tạm ngưng, ≥1 ADMIN ACTIVE).
- Danh sách nhân viên trả thêm: `customPermissions`, `permissions` (quyền hiệu lực, dạng khóa).
- Bỏ khả năng sửa quyền chung theo vai trò: xóa route `PUT /api/staff/roles/:role/permissions` và hàm `setRolePermissions` cùng test của nó. `GET /api/staff/roles` giữ (mẫu quyền + danh mục). Giữ `rolePermissionModel` để đọc mẫu.
- Tests: tạo với quyền riêng; trùng mẫu → không custom; danh sách rỗng → custom rỗng (`/me` permissions = []); đổi vai trò reset; tự sửa quyền mình → 403; cấp quyền mình không có → 403; ADMIN bỏ qua permissions; khóa lạ → 400; quyền riêng áp ngay vào `requirePermission`.

## Client (design admin hiện có)
- Drawer Thêm/Sửa nhân viên: mục "Quyền truy cập" đổi thành danh sách checkbox (nhãn tiếng Việt) theo danh mục. Mở drawer: tick theo quyền hiệu lực của người đó (thêm mới: mẫu vai trò mặc định). Đổi vai trò trong select → tick lại theo mẫu vai trò mới. Có nút nhỏ "Dùng quyền mặc định của vai trò" để khôi phục mẫu. Khi chọn vai trò Admin: tất cả tick và khóa, ghi chú "Admin luôn có toàn quyền". Khi sửa chính mình: checkbox khóa, giữ ghi chú hiện có.
- Ẩn/khóa các quyền mà người đang thao tác không có.
- Gửi `permissions` khi lưu (mảng các ô đang tick).
- Bảng nhân viên: cạnh nhãn vai trò hiện Badge nhỏ "Tùy chỉnh" khi `customPermissions`.
- Xóa panel "Phân quyền theo vai trò" và mã liên quan (API client `updateRolePermissions` nếu có).

## Tiêu chí nghiệm thu
`tsc` sạch, `npm run build`, `npm test` đạt (sau khi Claude migrate/generate). Không sửa code túi 3D, `.login-*`, không cài dependency, không commit. Không xóa file ngoài phạm vi đã nêu (chỉ xóa code panel/route trong file).
