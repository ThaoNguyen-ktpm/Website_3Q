# TASK-016 — Review: 3 vai trò, Admin tùy chỉnh quyền

- Dự án: web. Người review: Claude. Trạng thái: verified (phần đã kiểm chứng); thao tác thật trên giao diện sau đăng nhập Google: chờ Bảo thử.

## Claude làm
- Prisma từ chối `migrate dev --create-only` khi không tương tác (cảnh báo đổi enum) → viết tay `server/prisma/migrations/20261016060000_three_roles/migration.sql`: mở rộng enum tạm, chuyển OWNER → ADMIN, SALES/WAREHOUSE/ACCOUNTANT → STAFF, thu enum về ADMIN/MANAGER/STAFF (default STAFF), tạo bảng `RolePermission`. `prisma migrate deploy` áp thành công; `prisma migrate diff --from-schema-datasource --to-schema-datamodel --exit-code` = 0 (DB khớp schema).
- `prisma generate` lỗi EPERM do server dev của Bảo giữ DLL → dừng tiến trình con `tsx` (PID 17900), generate thành công, `tsx watch` tự chạy lại.
- `npm run db:seed`: 1 ADMIN; quyền mặc định MANAGER 9, STAFF 6.
- Dữ liệu: nhân viên id 1 (OWNER → ADMIN), id 2 (SALES → STAFF), không mất dòng.

## Bằng chứng
- `tsc --noEmit` server/client sạch; `npm run build` đạt; `npm test` 6 file, 121/121 đạt.
- Code: ADMIN luôn toàn quyền (không lưu DB, không sửa được); chỉ ADMIN sửa quyền (403); vai trò/khóa quyền lạ 400; danh sách rỗng lưu bằng dấu `__EMPTY__` để không bị trả về mặc định (có test); quyền đọc lại mỗi request nên có hiệu lực ngay.
- Giao diện (kết xuất component với API giả, không tạo phiên): panel "Phân quyền theo vai trò" 11 quyền × 3 vai trò, cột Admin khóa, nút "Lưu phân quyền" chỉ bật khi có thay đổi; thanh trên "NT · Nguyễn Văn Thảo · Admin".

## Giới hạn
Chưa lưu phân quyền/thêm nhân viên thật qua giao diện sau đăng nhập Google.
