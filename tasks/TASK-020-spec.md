# TASK-020 — Sao lưu database và chặn commit bí mật

- Dự án: vận hành (`scripts/`, `.githooks/`, `docs/`). Người phụ trách: Claude (đặc tả, review, đăng ký lịch Task Scheduler, thử khôi phục), Codex (script + tài liệu).
- Trạng thái: ready — Bảo duyệt kế hoạch bảo mật mục 7, 8 ("thực hiện", 2026-10-16). Mặc định: `D:\Backups\baoq_luxury`, 23:00 hằng ngày, giữ 14 bản.
- Chạy song song với TASK-019 (Codex khác) — CHỈ tạo/sửa các file liệt kê dưới đây; không đụng `server/`, `client/`.
- gitleaks 8.30.1 đã được Claude cài bằng winget; đã quét lịch sử: 1 phát hiện `generic-api-key` ở `client/index.html` dòng 12, commit `c909e38` — là token tạm của helper impeccable live (localhost:8400, đã tắt), không phải bí mật thật.

## 1. Sao lưu — `scripts/backup-db.ps1`
- Đọc `DATABASE_URL` từ `server/.env` (dòng không comment); tách user, mật khẩu, host, port, tên DB. Không in mật khẩu ra màn hình hay log. Truyền mật khẩu cho mysqldump qua file cấu hình tạm (`--defaults-extra-file`, quyền chỉ user hiện tại, xóa ngay sau khi chạy, kể cả khi lỗi) — không đặt trên dòng lệnh.
- mysqldump: tìm `C:\xampp\mysql\bin\mysqldump.exe`, cho phép ghi đè bằng tham số `-MysqldumpPath`.
- Tùy chọn: `--single-transaction --routines --triggers --default-character-set=utf8mb4 --no-tablespaces`.
- Xuất `D:\Backups\baoq_luxury\baoq_luxury_yyyyMMdd_HHmmss.sql`, nén thành `.zip` (Compress-Archive), xóa `.sql` sau khi nén thành công. Thư mục đích qua tham số `-BackupDir` (mặc định trên), tự tạo.
- Giữ 14 bản mới nhất (`-Keep`, mặc định 14), xóa bản cũ hơn **chỉ trong thư mục đích và chỉ file khớp mẫu tên**.
- Ghi log ngắn `backup.log` trong thư mục đích (thời gian, file, kích thước, lỗi). Exit code ≠ 0 khi thất bại.
- `scripts/restore-db.ps1`: khôi phục một file `.zip` vào DB đích (`-TargetDatabase`, BẮT BUỘC, từ chối nếu trùng DB đang dùng trong `.env` trừ khi có `-Force`), cùng cách truyền mật khẩu an toàn.
- `scripts/register-backup-task.ps1`: đăng ký Task Scheduler "BaoQ Luxury DB Backup" chạy `backup-db.ps1` hằng ngày 23:00 dưới user hiện tại (`-StartWhenAvailable`); có `-Unregister`. (Claude sẽ chạy sau khi review.)

## 2. Chặn commit bí mật
- `.githooks/pre-commit` (sh, chạy được trong Git for Windows): gọi `gitleaks git --pre-commit --staged --redact --no-banner`; tìm `gitleaks` trên PATH hoặc đường dẫn cài winget mặc định; nếu không có gitleaks → in cảnh báo và chặn commit (exit 1) kèm hướng dẫn cài.
- `.gitleaksignore`: thêm fingerprint của phát hiện ở `client/index.html` (commit `c909e38`) kèm comment giải thích. Fingerprint dạng `c909e38…:client/index.html:generic-api-key:12` — lấy chính xác bằng `gitleaks git . --report-path …` (cho phép Codex chạy gitleaks).
- Không tự chạy `git config core.hooksPath` (Claude làm sau review).

## 3. Tài liệu — `docs/BACKUP.md`
Cách chạy tay, lịch tự động, khôi phục, kiểm tra bản sao lưu, khuyến nghị chép thêm ra ổ khác/cloud (cùng ổ D là rủi ro), cách bật/tắt hook gitleaks.

## Kiểm tra (Codex)
PowerShell parse không lỗi (`[System.Management.Automation.Language.Parser]::ParseFile`). Không chạy backup thật (Claude chạy).

Không commit, không cài gói, không sửa `server/.env`.
