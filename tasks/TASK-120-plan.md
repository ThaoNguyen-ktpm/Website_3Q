Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-120 — Kế hoạch triển khai

Đặc tả: `tasks/TASK-120-spec.md`. Dùng stack hiện có, không thêm dependency, không commit, không gọi Kiot/Sapo thật, không quản lý tiến trình server. Triển khai trực tiếp theo yêu cầu của Bảo; Claude chạy toàn bộ test và review.

- [x] Thêm test fixture riêng `test/kiot-batch-runtime.test.js`: 1.311 món/27 lô, không PUT đơn hay Sapo, một LIST đầu lượt localOnly, fingerprint chặn sửa tay, lỗi 5xx/timeout không gửi lại, sai giá/mô tả/thiếu món đọc lại là unknown. Kiểm tra runtime bật batch và UI đang hiển thị số lô.
- [x] Thêm test phục hồi joint-v1: ready không có requestSent hoặc false → not_sent; ready có requestSent true và sending → unknown; done/lỗi cuối giữ nguyên. Nhật ký attempt và summary phải phản ánh kết quả phục hồi; hoàn tác giữ hành vi cũ.
- [x] Chạy test mới trước sửa; nếu subprocess bị EPERM, ghi lại và chạy riêng file mới in-process. Không chạy full core in-process.
- [x] Sửa tối thiểu runtime.ts truyền batchWrites:true; service.js phân loại ready chưa gửi và tổng hợp trạng thái/summary. Giữ LOT_SIZE=50, POLICY, bộ máy ghi/xác minh, khóa, background, restore và UI hiện có.
- [x] Chạy test tập trung, typecheck/syntax và diff; ghi kết quả thực tế, rủi ro Kiot bulk chưa chạy thật và các kiểm tra còn giao Claude vào TASK-120-result.md, trạng thái ready_for_review.

Các tình huống cần rà: requestSent true dù status ready; sending thiếu requestSent vẫn chưa xác định; sửa tay từ trước cursor phải bị full LIST chặn; thay đổi ở món lô sau phải bị listModified chặn; lỗi gửi không được tự resend hay làm lô sau dừng ngoài quy tắc hiện có.
