# TASK-139 — Kế hoạch triển khai

Đặc tả: `tasks/TASK-139-spec.md`. Giữ nguyên nền TASK-137/138; không commit, đổi nhánh, cài dependency hoặc ghi dịch vụ thật.

1. Giá vốn: test trước cho normalize/calculate; thêm cost cao nhất, hai lý do excluded và needs_approval; cập nhật POLICY và chỉ bổ sung cost vào fixture cũ.
2. Duyệt: dùng nhóm pending/legacy chung giữa view và prepare; duyệt dưới vốn hoặc trả vốn có metadata server tạo. Kiểm tra lại điều kiện, giá vốn và snapshot trước ghi qua cả ba engine hiện có. Giữ giá chỉ lưu kho cục bộ, gắn đúng giá đã xác nhận.
3. Giao diện: hai bảng có tìm kiếm/phân trang, nút từng món/tất cả, preview và xác nhận số món/tổng tiền, khóa thao tác; tab frontend lấy bộ đếm thật; lịch sử có nhãn.
4. BossTele: truyền cost vào calculate, kiểm tra nhánh caption sẵn có; không đổi công thức M hoặc quyền sale.
5. Kiểm chứng: test fake client cho các cổng, xung đột cost, kết quả sau ghi, giữ giá và lịch sử; chạy build/test website, lõi và BossTele. Ghi EPERM nếu sandbox chặn, bàn giao Claude ready_for_review.

Điểm cần kiểm kỹ: cờ duyệt không nhận simulated; trả vốn không làm đổi P0/M; cost đổi dù fingerprint giữ nguyên vẫn chặn; duyệt không trở thành miễn trừ vĩnh viễn; giữ giá hết hiệu lực khi giá đổi.
