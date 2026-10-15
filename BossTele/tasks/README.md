# Bàn giao công việc Codex và Claude

> Lưu trữ: quy trình đã chuyển lên `D:\Website_3Q\tasks\README.md`. Công việc mới ghi tại `../../tasks/`, đánh số từ `TASK-009`. Thư mục này giữ `TASK-001` đến `TASK-008`.

Codex viết và sửa code toàn bộ dự án. Claude phân tích, đề xuất và kiểm tra.

## Tài liệu cho mỗi công việc
- `TASK-001-spec.md`: Claude viết mục tiêu, phạm vi, yêu cầu và tiêu chí nghiệm thu.
- `TASK-001-result.md`: Codex viết thay đổi đã thực hiện, bằng chứng kiểm tra và giới hạn.
- `TASK-001-review.md`: Claude viết phát hiện, bằng chứng kiểm tra độc lập và kết luận.

Tăng số công việc cho yêu cầu mới. Sửa bổ sung cùng một công việc thì cập nhật các tài liệu tương ứng, giữ lại bằng chứng cần thiết.

## Trạng thái
`proposed` → `ready` → `in_progress` → `ready_for_review` → `verified`.

Nếu review phát hiện lỗi: `changes_requested` → Codex sửa → `ready_for_review` → Claude kiểm tra lại.
Nếu thiếu thông tin hoặc môi trường cần thiết, ghi `blocked` cùng nguyên nhân và điều kiện tiếp tục.

Mỗi tài liệu nên có mã công việc, người phụ trách, trạng thái, hành động gần nhất, bước tiếp theo và bằng chứng. Đặc tả `ready` phải dựa trên yêu cầu đã được người dùng giao hoặc chấp thuận.

## Cách sử dụng
1. Mở Claude tại `D:\Website_3Q\BossTele`, yêu cầu phân tích dự án và lập đặc tả theo `CLAUDE.md`.
2. Mở Codex tại cùng thư mục, yêu cầu triển khai đặc tả đã thống nhất theo `AGENTS.md`.
3. Yêu cầu Claude kiểm tra code và kết quả; Codex xử lý các lỗi được ghi nhận.

Các file này hướng dẫn vai trò và lưu bàn giao; chúng không tự khởi chạy, kết nối hay điều phối hai ứng dụng.

## Demo TASK-001
Claude lập đặc tả CLI cộng hai số trong `TASK-001-spec.md`; Codex triển khai `../add.js` và ghi `TASK-001-result.md`; kết quả kiểm tra độc lập của Claude lưu tại `TASK-001-review.md` khi review hoàn tất.

Chạy tại `D:\Website_3Q\BossTele`:
```powershell
node add.js 2 3
node --test
```
Lệnh đầu in `5`. Đây là tác vụ minh họa quy trình, chưa phải chức năng của dự án chính.
