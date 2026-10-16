# TASK-020 — Kết quả triển khai

- Dự án: vận hành Website_3Q.
- Người triển khai: Codex.
- Trạng thái: **ready_for_review**.
- Hành động gần nhất: hoàn tất script, hook, tài liệu; chạy parse và 7 kịch bản fixture; quét gitleaks lịch sử sau ngoại lệ.
- Bước tiếp theo: Claude review độc lập, chạy lại kiểm tra ACL ngoài sandbox; sau đó mới thử backup/restore DB thật, bật hook và đăng ký lịch theo đặc tả.

## Thay đổi

- `scripts/db-common.ps1`: đọc DATABASE_URL không comment, hỗ trợ nháy/comment cuối dòng và URL decoding, tách host/port/user/password/database. Tạo thư mục tạm với ACL chỉ SID user hiện tại ngay lúc tạo, ghi client.cnf UTF-8 không BOM. Truyền `--defaults-extra-file` đầu tiên; không truyền password qua command line. Dọn file trong finally, chờ/dừng client trước khi dọn; không in stdout/stderr native có thể chứa bí mật.
- `scripts/backup-db.ps1`: tham số theo đặc tả; mysqldump đủ 5 tùy chọn; SQL → Compress-Archive → xóa SQL khi thành công. Giữ ZIP mới nhất theo timestamp trong tên; chỉ xóa file tên khớp chính xác ngay trong BackupDir. Không ghi đè tên đã tồn tại. Log thời gian/file/bytes hoặc bước thất bại; exit 1 khi lỗi. Không retention sau dump/nén lỗi. SQL dở giữ lại để kiểm tra, đã nêu trong tài liệu.
- `scripts/restore-db.ps1`: TargetDatabase bắt buộc; chặn cùng DB trong env, không phân biệt hoa/thường, trừ khi Force. Chỉ nhận ZIP chứa một SQL đúng mẫu, không rỗng, không giải nén đường dẫn từ archive. Nạp bytes qua stdin mysql.exe với cùng cơ chế credential tạm. Không tự tạo DB đích.
- `scripts/register-backup-task.ps1`: đăng ký/gỡ task đúng tên, 23:00 daily, StartWhenAvailable, user hiện tại, S4U/limited; bỏ qua lần chạy chồng. Có SupportsShouldProcess để kiểm tra WhatIf. Chưa đăng ký thật. S4U không dùng ổ mạng/EFS; Windows có thể yêu cầu quyền đăng ký/batch logon, cần kiểm tra thật sau review.
- `.githooks/pre-commit`: gọi đúng lệnh yêu cầu, tìm PATH và WinGet Packages/Links; thiếu scanner thì chặn commit và chỉ dẫn cài.
- `.gitleaksignore`: chỉ fingerprint `c909e38482a0681d0e8eb427cd40b5ca6eed5919:client/index.html:generic-api-key:12`, kèm giải thích helper localhost đã tắt theo đặc tả. Không ignore cả file/rule.
- `scripts/test-task020.ps1`: self-check tạo env và native executable MySQL giả, không dùng env/DB thật; có tùy chọn SandboxFixtureAcl chỉ thay helper bản sao của fixture.
- `docs/BACKUP.md`: lệnh PowerShell chạy tay, lịch, restore vào DB thử, kiểm tra backup, giới hạn ACL/SQL/transaction/S4U, sao chép ra ổ vật lý khác/cloud, bật/tắt hook và cách tự kiểm tra.

## Bằng chứng kiểm tra

1. `[System.Management.Automation.Language.Parser]::ParseFile` trên cả 5 file `scripts/*.ps1`: **0 lỗi/file**, Windows PowerShell 5.1.26100.9549. Đã sửa lỗi overload Split không tương thích PowerShell 5.1 được fixture phát hiện.
2. `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-task020.ps1 -SandboxFixtureAcl`: **PASS 7 kịch bản**, exit 0 sau thay đổi cuối:
   - Parse URL fixture gồm comment, URL-encoded password, port và query.
   - Fake dump đủ flags, password không nằm trong args; ZIP hợp lệ, SQL được xóa, retention đúng và giữ file không khớp mẫu.
   - Restore ZIP fixture thành công; dọn thư mục credential.
   - Chặn DB hiện tại kể cả đổi hoa/thường, trước khi gọi fake client.
   - Force cho phép DB hiện tại trên fixture.
   - Từ chối ZIP chứa SQL khác mẫu, trước khi gọi client.
   - Native exit 7 → backup exit khác 0, không chạy retention, dọn config và không ghi stderr nhạy cảm vào log/output.
3. `powershell.exe -NoProfile -File scripts/register-backup-task.ps1 -WhatIf` và `... -Unregister -WhatIf`: chỉ in hành động dự kiến, exit 0. **Không đăng ký/gỡ task thật**.
4. Chạy executable gitleaks có sẵn ở WinGet: `gitleaks git . --redact --no-banner --report-path scripts/task020-gitleaks-report.json` trước ignore: 11 commits, 1 phát hiện, lấy fingerprint chính xác ở trên. Không xuất Secret/Match ra màn hình. Report tạm đã xóa.
5. Sau ignore: `gitleaks git . --redact --no-banner`: **11 commits, no leaks found**, exit 0. Đây là quét lịch sử, không chứng minh hook đã được bật hoặc bắt được secret staged.

## Giới hạn và việc Claude cần kiểm tra

- **Chưa được Claude review độc lập**, chưa verified.
- Không chạy backup/restore thật, không kết nối DB thật, không đọc `server/.env` thật khi tự kiểm tra; chỉ code sản phẩm tham chiếu đường dẫn env thật. Không đăng ký Task Scheduler, không git config, không commit, không cài gói. Không sửa server/client hay công việc TASK-019.
- Không chạy npm build/test website: thay đổi thuộc script vận hành, website đang được TASK-019 sửa song song; build sinh file ngoài phạm vi scripts/.githooks/.gitleaksignore/docs/BACKUP.md/tasks/TASK-020-result.md được giao. Chưa xác minh website trong lượt này.
- **ACL thực tế chưa đạt kiểm tra đầu-cuối trong sandbox**: đã tạo được directory có ACL duy nhất `Admin Allow FullControl`, nhưng restricted token không ghi/xóa được nội dung trong directory đó (Access denied). Do đó bản self-check thành công dùng `-SandboxFixtureAcl`: giữ nguyên code ACL sản phẩm, chỉ helper được sao chép vào fixture dùng ACL kế thừa. Claude cần chạy `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-task020.ps1` **không switch** từ PowerShell ngoài sandbox để kiểm chứng ghi/xóa config và ACL file qua fake client, trước backup thật.
- `sh.exe -n .githooks/pre-commit` bị Git for Windows runtime dừng trước parse: `CreateFileMapping ... Win32 error 5`. Chưa chạy được hook (kể cả nhánh thiếu công cụ/phát hiện staged secret) trong sandbox. Claude cần thử trong repository fixture riêng ngoài sandbox; không stage secret vào checkout này.
- Dọn fixture có ACL riêng gặp Access denied; lần yêu cầu khôi phục ACL rồi xóa đã bị hệ thống tự động từ chối với thông báo `blocked by policy`, không nêu lý do chi tiết. Không thử vượt chặn. File fixture thông thường/executable đã xóa; còn directory **rỗng** cần dọn ngoài sandbox (đã kiểm tra mỗi directory có 0 entry):
  - `%TEMP%\baoq-db-002a48ba5d4446f1945782b1f992fd10`
  - `%TEMP%\baoq-db-ae4e825bf0bc4d0787386c3affb400bc`
  - `D:\Website_3Q\scripts\.task020-test-e1a73ff4fe4d496bbef0804bd386e034\temp\baoq-db-7829a738107e4a17923340a5099af943` (sau đó xóa hai directory cha fixture rỗng). Không có mật khẩu thật trong các directory này; việc ghi credential fixture đã bị từ chối ngay từ đầu.
- Backup ZIP không mã hóa. Restore chỉ dành cho SQL tin cậy từ script; tên DB đích không cách ly câu SQL có schema/DEFINER cố định. Mất điện/kill cưỡng bức có thể bỏ qua finally. Các giới hạn này đã ghi trong BACKUP.md.
