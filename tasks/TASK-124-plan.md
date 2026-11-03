Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-124 — Kế hoạch triển khai

- Spec: `tasks/TASK-124-spec.md`; triển khai trực tiếp theo yêu cầu, không chờ duyệt kế hoạch, không commit.
- Dùng Ponytail full, systematic-debugging, test-driven-development, writing-plans, security-and-hardening và verification-before-completion; yêu cầu người dùng giao toàn bộ test cho Claude được ưu tiên hơn bước chạy red/green của skill.
- Phạm vi: `lib/kiot.js`, `test/kiot-transport.test.js` trong `Webstie/server/src/sale-ai/`, kế hoạch và result TASK-124. Giữ mọi thay đổi có sẵn.

1. Viết test HTTP loopback trước: PUT tiếng Việt và POST form có Content-Length đúng byte, không chunked; header nghiệp vụ; lỗi 420 có lý do đã che bí mật; lỗi lớn/JSON hỏng không lộ body; giữ phân loại 401/408/429/5xx và không retry PUT.
2. Sửa transport dùng cùng một chuỗi cho tính độ dài và ghi body, giữ mặc định Accept/User-Agent của fetch. Giới hạn bộ đệm phản hồi lỗi ở 2048 byte; chỉ trích trường câu lỗi JSON, không đưa toàn bộ body vào thông báo. Áp dụng cả auth và request; giữ timeout/retry, lô 50, xác minh, khóa, phục hồi.
3. Kiểm tra cú pháp và diff (không chạy suite); viết result tiếng Việt, bảng header cũ/mới và lệnh bàn giao Claude. Chưa khẳng định nguyên nhân HTTP 420 thật hoặc test đạt.

Điểm cần review: UTF-8 nhiều byte; form auth; body lỗi quá lớn hoặc JSON hỏng; token/secret thô và URL-encoded trong câu lỗi; 401 vẫn xóa token, 429 giữ Retry-After, 408/5xx PUT vẫn uncertain. Không truy cập .env hoặc API thật, không dừng/khởi động lại server.
