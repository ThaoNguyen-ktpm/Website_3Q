# TASK-003 — Chuẩn bị Claude-Mem

- Người phụ trách: Codex.
- Trạng thái: blocked_activation.
- Yêu cầu: cài thedotmack/claude-mem vào BossTele.
- Hành động gần nhất: tải/pin mã nguồn, kiểm tra manifest và chuẩn bị cấu hình dự án chưa áp dụng.
- Bước tiếp theo: người dùng cho phép rõ việc hook lưu session/code và gửi dữ liệu tóm tắt tới Anthropic; sau đó xử lý tương thích CLI và hoàn tất cài/runtime verification.

## Bằng chứng
- `git clone --depth 1 https://github.com/thedotmack/claude-mem.git vendor/claude-mem`: thành công.
- `git -C vendor/claude-mem checkout --detach fef3402e674bebbf72a23aeb735e91c92cd34afd`: thành công.
- package và plugin manifest: v13.39.0.
- Lệnh `claude plugin install claude-mem@thedotmack --marketplace D:\BossTele\vendor\claude-mem --scope project --json` bị auto-review từ chối trước khi chạy vì hook/service thu thập và lưu session/code, chưa có phép rõ về tác động dữ liệu và chưa chứng minh không sync bên ngoài.
- `claude plugin validate` báo tên plugin và marketplace dùng tiền tố dành riêng `claude-`.
- Đã đọc cấu hình upstream: cloud sync tắt khi URL trống; telemetry có thể tắt qua env; provider Claude vẫn xử lý dữ liệu qua Anthropic.

## Kết quả và giới hạn
- Source và cấu hình đề xuất ở `docs/CLAUDE-MEM.md` cùng hai file JSON.
- Chưa bật hook, chưa khởi chạy worker, chưa ghi quan sát, chưa test tìm lại bộ nhớ hoặc dùng chung giữa Claude/Codex.
- Chưa áp dụng JSON đề xuất vào cấu hình agent đang hoạt động; không thay phân vai hoặc bộ skill Ponytail.
