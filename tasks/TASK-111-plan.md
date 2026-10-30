# TASK-111 — Kế hoạch triển khai

**Mục tiêu:** Dọn đúng các phần cũ trong TASK-111; giữ schema, dữ liệu, vendor, backup và thay đổi task khác.
**Đặc tả:** `tasks/TASK-111-spec.md`.
**Cách thực hiện:** Codex trực tiếp triển khai theo yêu cầu người dùng; không commit, không khởi động/dừng server hiện hành, không xin quyền.

- [x] Kiểm kê người gọi API sản phẩm/model, tham chiếu cũ và số test trước sửa.
- [x] Thay bản chép máy chủ bằng helper mỏng gọi `createSaleAi`, dùng store/client cách ly. Giữ test nghiệp vụ; chuyển kiểm tra token cũ sang xác thực/quyền website hiện hành và kiểm Origin qua middleware thật.
- [x] Bỏ origin cũ, API sản phẩm SQLite và model không dùng; giữ schema, quyền sản phẩm và health route.
- [x] Cập nhật tài liệu BossTele; xóa thư mục Sale AI rỗng. Thư mục thử nghiệm scripts còn lại bị Access denied, ghi danh sách trong result.
- [x] Chạy build/test web, lõi Sale AI, BossTele; kiểm tham chiếu còn lại và ghi số test trước/sau, giới hạn vào result. Một số lệnh bị EPERM, chưa được xem là đạt.

**Trọng tâm kiểm tra:** không chạm dữ liệu thật; helper không sao chép nghiệp vụ; xác thực/Origin vẫn chặn trước core; test không giảm ngoài API bị gỡ; thay đổi có sẵn không bị hoàn tác.
