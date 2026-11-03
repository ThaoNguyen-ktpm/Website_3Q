Máy: Laptop (DESKTOP-4G5GOSR)

# Kế hoạch TASK-118 → TASK-117

1. TASK-118: thêm test mô tả null, giá 0, rollback và retry; chuẩn hoá mô tả rỗng khi so sánh, chặn ghi cả hai bên trước send gate; cập nhật nhóm lịch sử và tóm tắt.
2. Chạy kiểm tra tập trung bằng fixture, ghi TASK-118-result.md; không chạy bộ lõi đầy đủ.
3. TASK-117: test khoá có chủ, PID chết/sống và khoá cũ; bổ sung thu hồi khoá bỏ lại có kiểm tra chủ, retry khởi tạo và tắt êm có giới hạn.
4. Thay chờ thời gian thật trong E2E bằng tiến trình/đồng hồ giả; chạy kiểm tra được sandbox cho phép, ghi TASK-117-result.md.

Giữ nguyên diff có sẵn; không dữ liệu thật, không restart/stop, không commit, không dependency mới. Claude thực hiện full test/build và review độc lập. Điểm cần kiểm tra kỹ: ghi cả hai bên khi Sapo 0; null/chuỗi rỗng sau rollback; khoá sống không bị gỡ; retry không chồng nhau; shutdown không tháo khoá khi writer còn ghi.
