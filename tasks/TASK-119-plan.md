Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-119 — Kế hoạch triển khai

Đặc tả: `tasks/TASK-119-spec.md`. Thực hiện trực tiếp theo yêu cầu Bảo; không commit, không gọi dịch vụ thật, không điều khiển server, không chạy toàn bộ core in-process.

- [x] Viết test fixture chỉ Kiot cho ghi đơn, lô, nền, mô tả bị đổi sau ghi, Sapo giá 0/thiếu chỉ mục, hoàn tác mới và chặn hoàn tác cũ; chạy test trước sửa.
- [x] `runtime.ts`, `core.js`, `lib/live.js`: truyền `sapoWrite:false`, `kiotDescription:false`; chặn tải Sapo tự động; lưu cờ mô tả vào proposal/journal để hoàn tác theo đúng lượt. Mặc định thư viện giữ hành vi cũ cho test cũ.
- [x] `joint-update.js`, `batch-joint.js`, `batch-update.js`: chỉ gửi basePrice khi cờ false, xác minh giá và mô tả gốc, bước ghi “Gửi giá”. Giữ fingerprint, nền, khóa, policy và kiểm soát lỗi.
- [x] `restore.js`: lượt mới chỉ ghi giá; lượt cũ chứa Sapo bị chặn trước mạng khi Sapo tắt, giữ đường legacy khi bật.
- [x] `public/live-ui.js`, dữ liệu history nếu cần: nút cập nhật giá Kiot, ghi chú tham khảo, hoàn tác giá và cảnh báo lượt Sapo cũ. Test render bằng fixture.
- [x] Chỉnh E2E sang mặc định chỉ Kiot, giữ case hai bên bằng cờ legacy rõ ràng; kiểm tra tập trung, syntax/typecheck phù hợp và ghi giới hạn sandbox vào result. Claude chạy build/full tests và E2E 5 lần.

Điểm kiểm tra: PUT không có description ở client thật qua fetcher giả lập; mô tả sai sau ghi phải lỗi; không đọc Sapo lúc startup/refresh; proposal cũ không được bật lại Sapo khi cấu hình tắt; rollback dùng cờ journal thay vì cờ hiện tại.
