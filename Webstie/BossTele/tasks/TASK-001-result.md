# TASK-001 — Kết quả triển khai

- Người phụ trách: Codex.
- Trạng thái: verified.
- Hành động gần nhất: Claude review độc lập, tự chạy 30/30 kiểm thử đạt; Codex sửa ghi nguồn yêu cầu trong đặc tả theo góp ý.
- Bước tiếp theo: người dùng có thể chạy demo hoặc giao yêu cầu dự án chính.

## Thay đổi
- `add.js`: cộng đúng hai số hữu hạn; kiểm tra định dạng, số đối số và tràn số; export hàm để kiểm thử.
- `test/add.test.js`: kiểm thử hàm và tiến trình CLI, gồm đầu vào sai ở cả hai vị trí, chuỗi rỗng, khoảng trắng, xuống dòng, tràn số và biên hợp lệ.
- Không cài dependency; chương trình chỉ nhận đối số và ghi stdout/stderr.

## Kiểm chứng
- Node v24.21.0.
- `node add.js 2 3`: stdout `5`, exit 0.
- `node --test`: 30 test đạt, 0 lỗi; kết quả lưu trong `tasks/TASK-001-tests.txt`.
- Sandbox ban đầu chặn tạo tiến trình con với `spawn EPERM`; chạy lại bộ kiểm thử với quyền được auto-review cho phép. Đây là kiểm tra cục bộ.

## Nguồn đặc tả và giới hạn
- Đặc tả thật do Claude Code trả về; phản hồi gốc lưu tại `tasks/TASK-001-analysis.json`.
- Người dùng yêu cầu một demo nhỏ; ví dụ cộng hai số do Codex chọn cho demo. Câu tiếng Anh trong mục bằng chứng của đặc tả là prompt Codex gửi Claude, không phải trích nguyên văn người dùng.
- Dùng số IEEE 754 của JavaScript; không cam kết độ chính xác số thập phân tùy ý.
- Claude đã review và kết luận `verified` trong `tasks/TASK-001-review.md`; phản hồi gốc lưu tại `tasks/TASK-001-review-response.json`.
- Đã sửa nguồn yêu cầu ở đặc tả theo góp ý review; phản hồi gốc của Claude vẫn được giữ trong JSON. Góp ý bỏ điều kiện `trim()` là tùy chọn, giữ nguyên code đã được review.
