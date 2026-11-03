Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-126 — Kế hoạch triển khai

Spec: `tasks/TASK-126-spec.md`. Giữ nguyên TASK-125; Node/JS và dependency hiện có. Người dùng đã giao triển khai trực tiếp; không chờ duyệt kế hoạch, không commit. Claude chạy test/build.

- [x] Đo bản trước sửa bằng client giả, 4.800 sản phẩm/1.311 món, 59 trang × 600 ms, PUT 700 ms, listModified 400 ms, SplitStore trong thư mục tạm. Lưu script và số đo tái lập.
- [x] Mốc đọc: refresh không đổi dữ liệu vẫn cập nhật mốc cho bảng hiện hành bằng snapshot mới, không sửa snapshot lịch sử; không suy mốc từ thời điểm xác nhận. Thiếu mốc phải thông báo đúng spec trước all().
- [x] Nhật ký: lưu gọn lượt chỉ giá Kiot (before/after tối thiểu, fingerprint đầy đủ); SplitStore chia items và báo cáo attempt theo khối 50, vẫn đọc blob cũ. Giữ products/index nguyên định dạng cho BossTele. Bổ sung gzip lossless cho blob bảng lớn để tránh giữ thêm ~23 MB/lượt trong phép đo; không đổi rows trong bộ nhớ/API.
- [x] Dọn: audit theo cả tham chiếu khối con, chạy dọn sau hoàn tất lượt và lần lưu sau mở kho; giữ cơ chế khóa/kiểm hash/7 bảng và lỗi dọn không làm mất kết quả đã công bố.
- [x] Viết test mốc cũ/mới, sửa tay, roundtrip/chunk/corrupt/save-failure, lịch sử/hoàn tác/chọn lỗi cả định dạng cũ và mới, dọn giữ 7 lượt; Claude chạy để xác nhận.
- [x] Đo sau với cùng script/client/kho tạm, kiểm cú pháp và diff, ghi result cùng giới hạn. Không chạy build/test suite theo phân công. Chưa đạt `saveMs < 5 s`: đo cuối 5,527 s, ghi rõ trong result.

Điểm cần rà: refresh tự động không đổi giá; mốc tương lai/thiếu mốc; mất kết quả PUT và save hỏng phải đóng cổng; blob con thiếu/hỏng không được bỏ qua; nhật ký cũ có Sapo không được chuyển nhầm sang chỉ giá.
