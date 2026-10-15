# TASK-004 — Đưa kế hoạch định giá vào tài liệu hệ thống

- Người phụ trách: Codex.
- Trạng thái: documentation_saved; chưa có review độc lập của Claude.
- Yêu cầu: đưa file kế hoạch người dùng cung cấp vào hệ thống để làm cơ sở tính giá về sau.
- Hành động gần nhất: lưu bản gốc, tạo tài liệu nền tảng và nối hướng dẫn đọc vào AGENTS.md/CLAUDE.md.
- Bước tiếp theo: Claude phân tích các điểm cần chốt khi người dùng giao triển khai tính giá.

## File
- `docs/reference/price-system-plan.txt`: bản sao nguyên vẹn của `[PLAN] Thiết kế hệ thống AI Agent định giá.txt` từ Desktop.
- `docs/PRICE-SYSTEM.md`: luồng, dữ liệu, định hướng giá và danh sách các quyết định chưa chốt.
- `AGENTS.md`/`CLAUDE.md`: hướng dẫn đọc tài liệu khi làm nhiệm vụ định giá, giữ nguyên phân vai.

## Kiểm chứng và giới hạn
- SHA256 bản nguồn và bản sao đã được so sánh bằng Get-FileHash, khớp nhau.
- Đã kiểm tra nội dung UTF-8, đường dẫn tham chiếu và phép tính markup/margin minh họa.
- Phân biệt nội dung STEP/prompt với yêu cầu hiện tại; không thực thi lộ trình hoặc tự chọn SDK/model.
- Không sửa code tính giá, không bật Claude-Mem, không kết nối KiotViet/Sapo, không thay chính sách ở dự án BaoQ khác.
