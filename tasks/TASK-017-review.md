# TASK-017 — Review: quyền riêng từng nhân viên

- Dự án: web. Người review: Claude. Trạng thái: verified (phần đã kiểm chứng); lưu quyền thật sau đăng nhập Google: chờ Bảo thử.

## Claude làm
- Sinh SQL bằng `prisma migrate diff --from-schema-datasource … --script`, ghi `server/prisma/migrations/20261016080000_staff_permissions/migration.sql` (thêm cột `Staff.customPermissions` mặc định false, bảng `StaffPermission` khóa (staffId, permission), FK cascade). `migrate deploy` thành công; kiểm tra drift = 0. Không đổi dữ liệu cũ.
- `prisma generate` (dừng tiến trình con `tsx` PID 25336 của server dev giữ DLL; `tsx watch` tự chạy lại).
- Sửa 2 test trong `staff.test.ts` còn so khớp tham số kiểu cũ của `model.create` (nay có thêm `customPermissions`, `permissions`, tham số transaction): chuyển sang `toMatchObject` và kiểm `customPermissions:false`. Logic không đổi.

## Bằng chứng
- `tsc --noEmit` server/client sạch; `npm run build` đạt; `npm test` 6 file, 123/123 đạt.
- Code: ADMIN luôn toàn quyền; quyền hiệu lực = riêng (nếu `customPermissions`) hoặc mẫu vai trò; trùng mẫu → không lưu riêng; đổi vai trò không gửi quyền → về mẫu mới; không tự sửa quyền mình; không cấp quyền mình không có; route sửa quyền chung theo vai trò đã bỏ.
- Client: khi tự sửa chính mình không gửi `permissions` (tránh 403 khi chỉ đổi họ tên).
- Giao diện (component + API giả, không tạo phiên): drawer 11 checkbox, tick đúng quyền riêng; nút "Dùng quyền mặc định của vai trò"; bảng hiện nhãn "Tùy chỉnh"; panel phân quyền theo vai trò đã bỏ.

## Giới hạn
Chưa lưu quyền riêng thật qua giao diện sau đăng nhập Google.
