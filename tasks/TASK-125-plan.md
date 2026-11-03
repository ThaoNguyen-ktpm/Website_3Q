Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-125 — Kế hoạch triển khai

Spec: `tasks/TASK-125-spec.md`. Giữ stack, giá, payload chỉ giá, lô 50, khóa, xác minh và phục hồi hiện có.

1. Viết test trước cho ghi đơn/lô, chọn lại trên bảng cũ, snapshot sau ghi, chọn tất cả và retry không tính món đúng giá; giá tay/mô tả/tồn kho đổi vẫn chặn. Dùng fixture trong bộ nhớ, không gọi dịch vụ thật.
2. Dùng chung kiểm tra snapshot Kiot: chỉ chấp nhận khác biệt giá/thời điểm sửa khi giá đã đúng và thông tin còn lại khớp, hoặc khớp chính xác snapshot sau ghi đã kiểm chứng trong nhật ký Sale AI. Giá khác dự kiến vẫn chặn.
3. Luồng nền đánh dấu `unchanged` trước gửi, không PUT, không lỗi; tổng hợp và retry hiểu trạng thái này. Đồng bộ sản phẩm/snapshot bảng sau xác minh cho cả ghi đơn/lô và luồng cũ.
4. Bảng hiển thị “Đã đúng giá trên Kiot”; chọn tất cả bỏ món này khi chế độ chỉ giá Kiot, không ảnh hưởng chọn Sapo.
5. Chỉ kiểm tra cú pháp và whitespace; không chạy build/test theo chỉ thị người dùng. Claude chạy toàn bộ test, E2E 5 lần và review độc lập. Ghi kết quả `ready_for_review`.

Điểm cần giữ khi review: bảng cũ trước TASK-125; modifiedDate thay sau PUT; mô tả/tồn kho đổi dù giá đã đúng; lượt có cả món ghi và món bỏ qua; snapshot lịch sử/khôi phục không bị ghi đè.
