# Sao lưu MySQL và hook gitleaks

TASK-020 cung cấp script; lịch và hook **chưa được bật**. Các lệnh dưới đây chạy trong **PowerShell** tại `D:\Website_3Q`, sau khi Claude review. Codex chưa chạy backup/restore DB thật.

## Sao lưu bằng tay

```powershell
cd D:\Website_3Q
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```

Script đọc duy nhất dòng `DATABASE_URL` không comment trong `server/.env` (MySQL URL; hỗ trợ dấu nháy, URL-encoded user/password và port; mặc định 3306). Không truyền mật khẩu bằng tham số hoặc ghi giá trị URL vào log. Dùng `C:\xampp\mysql\bin\mysqldump.exe`; ghi đè đường dẫn nếu cần:

```powershell
.\scripts\backup-db.ps1 -BackupDir 'D:\Backups\baoq_luxury' -Keep 14 -MysqldumpPath 'C:\xampp\mysql\bin\mysqldump.exe'
```

Kết quả: `baoq_luxury_yyyyMMdd_HHmmss.zip`, chứa một SQL cùng tên; xóa SQL sau khi nén thành công. Nếu dump/nén lỗi, SQL dở có thể còn lại để kiểm tra; bảo vệ/xóa thủ công sau khi xử lý. Script không ghi đè tên đã có; không chạy hai bản đồng thời. Chỉ xóa ZIP có tên khớp chính xác trong thư mục đích, giữ 14 bản mới nhất theo timestamp tên; không duyệt thư mục con. Log `backup.log` ghi thời gian, tên file, kích thước hoặc bước thất bại, không ghi stderr MySQL. Lỗi trả exit code khác 0; log chỉ ghi được khi có quyền vào thư mục đích.

Mật khẩu nằm trong `client.cnf` UTF-8 tạm, trong thư mục có ACL chỉ SID user hiện tại; xóa trong `finally` cả khi MySQL lỗi. Kill cưỡng bức tiến trình/mất điện có thể để lại file tạm `%TEMP%\baoq-db-*`: kiểm tra và xóa dưới đúng tài khoản. ZIP/SQL chứa toàn bộ dữ liệu DB, không được mã hóa: đặt ACL cho thư mục backup và bảo vệ nơi lưu. SQL lưu routines/triggers theo đặc tả; `--single-transaction` nhất quán cho bảng transactional, tránh thay đổi schema trong lúc dump. Tài khoản MySQL cần quyền đọc và quyền liên quan routines/triggers theo phiên bản máy chủ. Cần xác minh tương thích mysqldump XAMPP với MySQL đang dùng khi chạy thật.

## Lịch 23:00 hằng ngày

Chỉ chạy sau review:

```powershell
.\scripts\register-backup-task.ps1 -WhatIf
.\scripts\register-backup-task.ps1
Get-ScheduledTask -TaskName 'BaoQ Luxury DB Backup'
Get-ScheduledTaskInfo -TaskName 'BaoQ Luxury DB Backup'
```

Task dùng Windows PowerShell, user hiện tại, S4U (không lưu mật khẩu đăng nhập Windows), quyền Limited, `StartWhenAvailable`, bỏ qua lần chạy chồng nhau. S4U chỉ dùng tài nguyên cục bộ; không đặt script/env/backup trên ổ mạng hay file EFS. Windows có thể yêu cầu PowerShell quản trị để đăng ký và quyền “Log on as a batch job” cho user. MySQL cần đang chạy, máy không tắt; kiểm tra `LastTaskResult` và `backup.log` sau lần chạy đầu. Script đăng ký cập nhật task cùng tên, không tự chạy backup. Gỡ:

```powershell
.\scripts\register-backup-task.ps1 -Unregister
```

## Khôi phục và kiểm tra bản sao

Chọn ZIP từ nguồn tin cậy do script này tạo. Kiểm tra ZIP mở được, chứa đúng một SQL không rỗng; giải nén được **chưa chứng minh** khôi phục thành công. Tạo trước một DB thử trống bằng công cụ MySQL, ví dụ `baoq_restore_check`; script không tự tạo DB. Host/user/password vẫn lấy từ `.env`:

```powershell
.\scripts\restore-db.ps1 -BackupFile 'D:\Backups\baoq_luxury\baoq_luxury_20261016_230000.zip' -TargetDatabase baoq_restore_check
```

Có `-MysqlPath` nếu mysql.exe ở nơi khác. Chỉ chấp nhận tên DB gồm chữ ASCII, số, `_`. Từ chối DB cùng tên trong `.env` (không phân biệt hoa/thường); `-Force` mới cho phép. Không dùng `-Force` để thử backup. Restore có thể ghi đè/xóa bảng trong DB đích, không có rollback khi lỗi; đối chiếu số bảng, số dòng và dữ liệu mẫu với bản gốc, kiểm tra routines/triggers sau khi restore vào DB thử. SQL/routines có thể chứa tên schema cố định hoặc `DEFINER`, cần review quyền và nội dung trước khi nhập. Không nhập ZIP/SQL không tin cậy: chọn DB đích không phải cơ chế cách ly mã SQL.

Giữ thêm một bản trên **ổ vật lý khác** hoặc cloud được phép, mã hóa và hạn chế truy cập. Backup trên cùng ổ D không bảo vệ trước hỏng ổ, ransomware hoặc mất máy. Kiểm tra restore định kỳ; không coi log `OK` là bằng chứng đã phục hồi được trên máy thật.

## Gitleaks pre-commit

Đã có `.githooks/pre-commit`, chưa thay đổi Git config. Sau review, Claude bật bằng:

```powershell
git config --local core.hooksPath .githooks
```

Hook Git for Windows tìm gitleaks trong PATH, WinGet Packages hoặc WinGet Links, rồi chạy `gitleaks git --pre-commit --staged --redact --no-banner`. Thiếu công cụ hoặc phát hiện bí mật đều chặn commit. Cài khi cần: `winget install --id Gitleaks.Gitleaks -e`; mở terminal mới sau cài. Không dùng `--no-verify` để bỏ qua phát hiện chưa xử lý.

`.gitleaksignore` chỉ bỏ qua fingerprint lịch sử của helper impeccable live đã tắt, theo TASK-020; không bỏ qua toàn bộ file/rule. Quét lịch sử không đưa giá trị bí mật ra màn hình:

```powershell
gitleaks git . --redact --no-banner
```

Muốn tắt hook này (chỉ khi local `core.hooksPath` hiện là `.githooks`), xem cấu hình rồi gỡ:

```powershell
git config --local --get core.hooksPath
git config --local --unset core.hooksPath
```

Việc gỡ có thể kích hoạt lại hooks ở vị trí mặc định hoặc cấu hình global. Hook chỉ chạy ở checkout đã bật, không bảo vệ mọi máy/CI tự động.

## Kiểm tra script không dùng DB thật

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-task020.ps1
```

Self-check tạo env và executable MySQL giả bên trong `scripts/.task020-test-*`, chạy dump/restore fixture, kiểm tra retention, chặn DB hiện tại và dọn file tạm. Không đọc `server/.env` thật. Trong sandbox có restricted token, dùng `-SandboxFixtureAcl`: chỉ bản helper sao chép vào fixture dùng ACL kế thừa để kiểm tra luồng; chế độ này **không kiểm chứng** ghi/xóa file mật khẩu với ACL riêng. Cần chạy lại self-check mặc định ngoài sandbox sau review.
