Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-116 — Kế hoạch triển khai

Spec: `tasks/TASK-116-spec.md`. Stack hiện có, không dependency mới.

1. Viết test fixture 1.500 món: nhận 202 dưới 1 giây, giữ busy/409, chạy hết và có lịch sử; đếm GET trước PUT, đồng hồ giả, thử lại và lỗi nền.
2. `core.js`: nhận công việc trước khi thực thi, giữ khóa qua prepare + commit, API tra trạng thái/kết quả; chuyển các thao tác HTTP có mạng sang nền. Không tự thử lại PUT.
3. `live.js`, `joint-update.js`, `batch-joint.js`: chuẩn bị cục bộ cho lượt mới; đọc và kiểm tra ngay trước ghi; lưu snapshot trước PUT. Luồng xác nhận cũ và rollback giữ kiểm tra cũ.
4. `public/live-ui.js`, `public/app.js`: một POST xác nhận cho cập nhật và cập nhật lại; theo dõi lượt nền, hiển thị tiến độ/kết quả và tải lại lịch sử khi mở lại trang.
5. `server.ts`: timeout HTTP hữu hạn, rõ ràng. Cập nhật helper test HTTP/E2E để chờ kết quả 202, giữ mọi tiêu chí nghiệp vụ.
6. Chạy kiểm tra cục bộ, ghi lỗi sandbox và giới hạn thực tế vào result; bàn giao `ready_for_review`, không commit/restart/gọi dịch vụ thật.

Điểm kiểm tra: mất kết nối trang; lỗi nền trước ghi; 409 giữa hai pha; dấu vân tay Kiot thay đổi; SKU Sapo sai/trùng; snapshot rollback; prepared cũ bị thay thế. Lượt nền không tự tiếp tục sau khi tiến trình máy chủ bị tắt; cơ chế nhật ký gián đoạn hiện có giữ nguyên.
