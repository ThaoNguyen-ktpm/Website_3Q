# TASK-015 — Review: bảng nhân viên, phân quyền, trang Nhân viên

- Dự án: web.
- Người review: Claude.
- Trạng thái: verified (phần đã kiểm chứng); đăng nhập Google thật vào admin + thêm nhân viên trên DB thật: chờ Bảo thử.
- Bảo giao toàn quyền 2026-10-16; ma trận quyền là đề xuất của Claude (xem `TASK-015-spec.md`), Bảo xem lại.

## Diễn biến
- Codex triển khai nhưng hết giờ (exit 124 sau 590 giây) trước khi ghi `TASK-015-result.md`; code đã viết đủ phần server/client, chỉ thiếu Prisma client mới.
- Claude: trỏ `server/.env` sang `baoq_luxury` (giữ dòng shop_test đã comment); `prisma migrate dev --name init` tạo DB `baoq_luxury` + migration `20261016032802_init`; `prisma generate` lần đầu lỗi EPERM do server dev của Bảo (`tsx watch`) giữ DLL → dừng tiến trình con PID 19304, generate lại thành công, `tsx watch` tự chạy lại server (PID 25852); `npm run db:seed` tạo 1 OWNER ACTIVE (email trong `GOOGLE_ALLOWED_EMAILS`, họ tên tạm = phần trước @).
- Claude sửa nhỏ `client/src/admin/views/App.jsx`: chữ viết tắt avatar lấy chữ đầu từ đầu + từ cuối (trước đó lấy 2 từ cuối: "Chủ cửa hàng mẫu" → "HM").

## Bằng chứng
- `tsc --noEmit` server/client sạch; `npm run build` đạt; `npm test` 5 file, 102/102 đạt.
- API thật qua proxy: `/api/staff` và `/api/auth/me` không cookie → 401.
- Đọc code `staffService.ts`: chỉ `staff.manage` thêm/sửa; chỉ OWNER gán/gỡ OWNER; không tự đổi vai trò/tự tạm ngưng; giữ ≥1 OWNER ACTIVE (trong transaction); trùng email 409; không trả `googleSub`. Router: `requireAuth` + `requirePermission`.
- Giao diện qua trang mô phỏng Codex tạo (`client/task-015-preview.html`, dữ liệu giả, không gọi API): trang Nhân viên đúng design admin (panel, bảng, badge trạng thái, nút "Thêm nhân viên"); thanh trên hiện hồ sơ thật (avatar, tên, vai trò, chevron); drawer có Họ tên, Email Google, Số điện thoại, Vai trò (5 lựa chọn), Trạng thái và danh sách quyền của vai trò.

## Ghi nhận
- `client/task-015-preview.html` là trang mô phỏng của Codex (dev), không vào bản build; giữ để xem giao diện không cần đăng nhập.
- `GOOGLE_ALLOWED_EMAILS` nay chỉ dùng khi seed tạo OWNER; đăng nhập kiểm theo bảng `Staff`.
- Các bảng shop cũ (User, Product, Order…) cũng được tạo trống trong `baoq_luxury` theo schema hiện có.

## Giới hạn
Chưa đăng nhập Google thật; chưa thêm/sửa nhân viên trên DB thật qua giao diện.
