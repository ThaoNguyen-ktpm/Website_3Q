# TASK-019 — Review: nhật ký thao tác

- Người review: Claude. Trạng thái: verified (phần đã kiểm chứng); ghi log thật khi đăng nhập/sửa nhân viên qua giao diện: chờ Bảo thử.

## Claude làm
- Migration `20261016120000_audit_log` (sinh bằng `prisma migrate diff`, bảng `AuditLog` + 3 index); `migrate deploy` thành công; drift = 0.
- `prisma generate` (dừng tiến trình con tsx PID 1892 của server dev giữ DLL; tsx watch tự chạy lại).

## Bằng chứng
- `tsc` sạch; `npm test` 8 file, 198/198 đạt; `npm run build` đạt.
- Code: ghi `auth.login`, `auth.login_denied` (lý do, không token), `auth.logout`, `staff.create` (bản ghi đã qua `safeStaff`, không `googleSub`), `staff.update` (chỉ trường đổi); lỗi ghi log không làm hỏng thao tác; dọn log > 365 ngày khi server khởi động và mỗi 24h (`startRetention` trong `server.ts`, timer `unref`).
- API thật: `/api/audit-logs` không phiên → 401.
- Giao diện (component + API giả): menu "Nhật ký" (chỉ khi có `audit.view`), bảng Thời gian / Người thực hiện / Hành động / Đối tượng / Chi tiết / IP, lọc + phân trang, lý do từ chối tiếng Việt.

## Ghi nhận
- Ghi log sau khi transaction xong (không cùng transaction) — chấp nhận theo spec (log lỗi không chặn thao tác).
- Lọc người thực hiện theo mã số nhân viên, chưa có ô chọn theo tên.
