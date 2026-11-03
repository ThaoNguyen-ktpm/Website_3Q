Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-112 — Sửa fixture E2E Sale AI sau TASK-108

- Dự án: web (Sale AI).
- Người phụ trách: Codex triển khai; Claude kiểm tra độc lập.
- Ngày: 02/11/2026.
- Trạng thái: `ready_for_review`. Đã hoàn tất code; chưa được Claude kiểm tra, chưa xác minh bộ E2E 14 ca do sandbox.
- Hành động gần nhất: sửa fixture, kiểm tra hồi quy và rà diff.
- Bước tiếp theo: Claude chạy lại E2E 14 ca, `npm test` và `npm run build` ngoài sandbox.

## Nguyên nhân đã xác nhận

`core.js` lên lịch đọc Sapo bằng `setImmediate(readSapoOnStartup)` khi Sapo đã kết nối nhưng chỉ mục chưa sẵn sàng. Lượt đọc dùng `perform()`, giữ `operationBusy` qua cả việc đọc và lưu chỉ mục. Fixture E2E dùng chỉ mục trống và SplitStore trên đĩa; refresh Kiot qua HTTP có thể tới trong lúc khóa này đang giữ, nhận 409 tại `perform()`.

Đã xác nhận bằng test lõi có chốt chờ cho lượt đọc Sapo: ngay trong lúc đọc nền, `POST /api/kiot/refresh` trả 409, trạng thái busy là true. Đây cũng là hành vi mặc định mà người dùng có thể gặp khi bấm **Tải lại từ Kiot** ngay sau khởi động, nếu chỉ mục chưa sẵn sàng. Thời gian chặn tùy tốc độ đọc/lưu; chưa đo số giây trên dịch vụ thật. Không thay đổi hành vi mặc định trong task này.

Chưa tái hiện trực tiếp 14 lỗi assertion E2E trong phiên này: Vitest bị sandbox chặn trước khi chạy ca kiểm thử.

## Thay đổi

- `Webstie/server/src/sale-ai/core.js`: thêm tùy chọn `readSapoOnStartup`, mặc định `true`; chỉ thêm điều kiện khi lên lịch đọc nền. Không đổi khóa, refresh, logic ghi giá, rollback hay quy tắc giá. Runtime hiện có không truyền tùy chọn nên giữ nguyên hành vi.
- `Webstie/server/src/tests/saleAiUpdateAll.test.ts`: fixture truyền `readSapoOnStartup:false`, giữ đủ 14 ca và các assertion hiện có, không chấp nhận thêm 409. Thêm hook `sapoRead` tại client giả lập.
- Ca 3 giữ ý nghĩa **không ghi khi chỉ mục Sapo chưa được xác minh**. TASK-108 đã khiến refresh Kiot tự đọc Sapo, nên bỏ bước refresh Sapo thủ công không còn đủ để tạo điều kiện này. Fixture ca 3 nay gây lỗi đọc Sapo; bổ sung assertion chỉ mục chưa ready và lỗi prepare liên quan Sapo, giữ assertion không có lần ghi nào. Đây là cập nhật thiết lập theo hành vi TASK-108, không nới lỏng test.
- `Webstie/server/src/sale-ai/test/sapo-auto-refresh.test.js`: giữ các test đọc nền mặc định, bổ sung kiểm tra 409 khi refresh Kiot trong lúc đọc nền và test riêng cho tùy chọn tắt startup; khi tắt, refresh Kiot vẫn tự đọc Sapo thành công.

## Bằng chứng kiểm tra trong phiên này

1. TDD cho tùy chọn mới, tại `Webstie/server`:
   - `node --test --test-isolation=none src/sale-ai/test/sapo-auto-refresh.test.js`
   - Trước sửa lõi: 13 đạt, 1 lỗi ở test tắt đọc startup (`true !== false`).
   - Sau sửa lõi: **14/14 đạt**, exit 0. Gồm test hành vi startup mặc định và 409 khi refresh trong lúc startup đang đọc.
2. `node --test --test-isolation=none src/sale-ai/test/sapo.test.js src/sale-ai/test/joint-update.test.js src/sale-ai/test/restore-joint.test.js`, tại `Webstie/server`: **40/40 đạt**, exit 0. Dùng client giả lập, không gửi cập nhật/khôi phục thật.
3. `$env:SALE_AI_E2E='1'; npx.cmd --no-install vitest run src/tests/saleAiUpdateAll.test.ts`, tại `Webstie/server`: exit 1, `spawn EPERM` khi esbuild nạp cấu hình. Chưa chạy test.
4. Thử cách chạy không bundle cấu hình: cùng lệnh E2E thêm `--configLoader native --pool threads`: exit 1, `spawn EPERM` tại `optimizeSafeRealPathSync` của Vite; **0 test được chạy**.
5. `npm.cmd test`, tại `Webstie`: exit 1, Playwright frontend bị `spawn EPERM` khi tạo worker. Chưa chạy được các ca frontend và chưa tới test server/lõi trong lệnh tổng.
6. `npm.cmd run build`, tại `Webstie`: build server (`tsc` và copy Sale AI) thành công, frontend `tsc --noEmit` thành công; Vite frontend bị `spawn EPERM` khi esbuild nạp cấu hình, tổng lệnh exit 1. Không coi build toàn bộ là đạt.
7. `node --test --test-isolation=none src/sale-ai/test/*.test.js`: thử mở rộng chạy cùng tiến trình; đã in 15 test đạt rồi không có tiến triển trong thời gian theo dõi. Đã ngắt riêng lệnh test này, exit 1; không có kết quả tổng, không coi toàn bộ lõi là đạt. Chế độ này không thay thế kiểm tra chuẩn có cách ly tiến trình.
8. `Get-CimInstance Win32_Process` để xem tiến trình test: bị `Access denied`; không xin quyền, không dùng lệnh này để dừng tiến trình nào.
9. `git diff --check`: đạt, exit 0; Git có cảnh báo chuẩn hóa LF/CRLF.

## Giới hạn và bàn giao

- Chưa xác minh 14/14 E2E hay toàn bộ test/build chuẩn; Claude cần chạy lại các lệnh bên dưới. Không thay cấu hình dự án để né sandbox.
- Chưa kiểm tra giao diện với phiên đăng nhập thật, không gọi Kiot/Sapo thật. Các test dùng store bộ nhớ hoặc kho tạm và client giả lập.
- Không dừng/khởi động lại máy chủ ứng dụng đang chạy; không bật bot Telegram, không commit, không cài dependency. Lệnh build có cập nhật artifact dist theo script sẵn có, không khởi động tiến trình phục vụ.
- Giữ nguyên thay đổi có sẵn ở `AGENTS.md`, `CLAUDE.md` và đặc tả TASK-112.

Claude chạy tại PowerShell:

```powershell
cd D:\Website_3Q\Webstie\server
$env:SALE_AI_E2E = '1'
npx.cmd --no-install vitest run src/tests/saleAiUpdateAll.test.ts
Remove-Item Env:SALE_AI_E2E
cd D:\Website_3Q\Webstie
npm.cmd test
npm.cmd run build
```

Tiêu chí bàn giao tiếp theo: E2E đủ 14 ca đạt, bộ test/build chuẩn đạt và Claude ghi review độc lập. Cho tới đó giữ `ready_for_review`.
