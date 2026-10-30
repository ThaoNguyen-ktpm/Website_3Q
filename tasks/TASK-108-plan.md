# TASK-108 — Kế hoạch triển khai

- Mục tiêu: tự đọc chỉ mục Sapo sau tải Kiot và một lần nền khi khởi động thiếu chỉ mục.
- Phạm vi: `core.js`, `lib/sapo.js`, `public/live-ui.js`, test mới chạy lõi thật; giữ nguyên logic ghi/khôi phục và giá TASK-105.
- Ràng buộc: chỉ client giả trong test, không gọi dịch vụ thật, không in khóa, không restart server, không commit, không hoàn tác thay đổi có sẵn.

1. Viết test lõi thật bằng store bộ nhớ và client giả: tải Kiot, lỗi Sapo/retry, khởi động, khóa thao tác, prepared thay đổi/không đổi, không PUT. Chạy trước khi sửa.
2. Dùng cùng `perform()` cho tải Kiot và đọc Sapo; lỗi đọc Sapo giữ bảng Kiot và trạng thái lỗi an toàn. Đọc nền sau khởi tạo, đợi khóa rảnh, chỉ một lần; so chỉ mục trước/sau để xóa prepared khi cần.
3. Bỏ hai nút đọc tay và panel; giữ thông báo chưa cấu hình, hiển thị lỗi ngắn; test HTML dựng ra.
4. Chạy test mới, bộ test Sale AI, build và npm test theo khả năng sandbox; ghi đầy đủ kết quả/giới hạn vào `TASK-108-result.md`, trạng thái `ready_for_review`.
