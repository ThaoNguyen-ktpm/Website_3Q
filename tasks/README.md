# Bàn giao công việc Claude và Codex

Claude giao việc bằng đặc tả và kiểm tra kết quả. Codex viết và sửa code toàn bộ dự án `D:\Website_3Q` (website và BossTele).

## Tài liệu cho mỗi công việc
- `TASK-xxx-spec.md`: Claude viết mục tiêu, phạm vi, yêu cầu và tiêu chí nghiệm thu.
- `TASK-xxx-result.md`: Codex viết thay đổi đã thực hiện, bằng chứng kiểm tra và giới hạn.
- `TASK-xxx-review.md`: Claude viết phát hiện, bằng chứng kiểm tra độc lập và kết luận.

Đánh số tiếp từ `TASK-009`; `TASK-001` đến `TASK-008` của BossTele được lưu tại `BossTele/tasks/`. Sửa bổ sung cùng một công việc thì cập nhật các tài liệu tương ứng, giữ lại bằng chứng cần thiết.

Mỗi tài liệu ghi: mã công việc, dự án (`web` hoặc `BossTele`), người phụ trách, trạng thái, hành động gần nhất, bước tiếp theo và bằng chứng.

## Trạng thái
`proposed` → `ready` → `in_progress` → `ready_for_review` → `verified`.

Nếu review phát hiện lỗi: `changes_requested` → Codex sửa → `ready_for_review` → Claude kiểm tra lại.
Nếu thiếu thông tin hoặc môi trường cần thiết, ghi `blocked` cùng nguyên nhân và điều kiện tiếp tục.

Đặc tả `ready` phải dựa trên yêu cầu đã được người dùng giao hoặc chấp thuận.

## Cách sử dụng
1. Mở Claude tại `D:\Website_3Q`, yêu cầu phân tích và lập đặc tả theo `CLAUDE.md`.
2. Mở Codex tại cùng thư mục, yêu cầu triển khai đặc tả đã thống nhất theo `AGENTS.md`.
3. Yêu cầu Claude kiểm tra code và kết quả; Codex xử lý các lỗi được ghi nhận.

Các file này hướng dẫn vai trò và lưu bàn giao; chúng không tự khởi chạy, kết nối hay điều phối hai ứng dụng.
