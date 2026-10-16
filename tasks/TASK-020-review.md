# TASK-020 — Review: sao lưu database và chặn commit bí mật

- Người review: Claude. Trạng thái: verified.

## Sao lưu
- Chạy thật `scripts/backup-db.ps1`: tạo `D:\Backups\baoq_luxury\baoq_luxury_20261016_114809.zip`, log OK; mật khẩu không in ra (truyền qua file cấu hình tạm).
- Khôi phục thử: `restore-db.ps1` ban đầu lỗi vì không tạo DB đích → Claude thêm bước `CREATE DATABASE IF NOT EXISTS` (tên DB đã qua ValidatePattern). Khôi phục vào `baoq_restore_test` thành công; so số dòng 11 bảng với `baoq_luxury`: giống hệt. Đã xóa DB tạm.
- Task Scheduler: `register-backup-task.ps1` ban đầu dùng `LogonType S4U` → Windows báo Access denied (cần quyền admin). Claude đổi sang `Interactive` (chạy khi Bảo đăng nhập; `StartWhenAvailable` chạy bù). Đăng ký thành công "BaoQ Luxury DB Backup", 23:00 hằng ngày; chạy thử bằng Task Scheduler: `LastTaskResult=0`, có bản `baoq_luxury_20261016_114922.zip`.

## Chặn commit bí mật
- gitleaks 8.30.1 (winget). Quét lịch sử: 1 phát hiện là token tạm của helper impeccable live (commit `c909e38`, `client/index.html`) — đã thêm fingerprint vào `.gitleaksignore`; quét lại: không còn phát hiện.
- `git config core.hooksPath .githooks` đã bật cho `D:\Website_3Q`.
- Thử trong repo tạm (scratchpad): token giả kiểu `ghp_` ngẫu nhiên → commit bị chặn (exit 1); chuỗi lặp "AAAA…" không bị bắt (gitleaks lọc chuỗi entropy thấp).

## Ghi nhận
- Bản sao lưu nằm cùng ổ D với dữ liệu — nên chép thêm ra ổ khác/cloud (`docs/BACKUP.md`).
