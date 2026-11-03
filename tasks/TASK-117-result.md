Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-117 — Kết quả

- Dự án: web / Sale AI. Người thực hiện: Codex.
- Trạng thái: `ready_for_review`; code đã triển khai, chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: hoàn tất sau TASK-118; typecheck và các kiểm tra offline tập trung đạt.
- Bước tiếp theo: Claude chạy Vitest, E2E **5 lần liên tiếp**, full suite và build. Chưa có bằng chứng 5 lần E2E đạt trong lượt này.

## Thay đổi và file liên quan

- `Webstie/server/src/sale-ai/lib/store-lock.js`: mỗi khoá có file chủ riêng ghi PID, createdAt, startedAt, startupId và token duy nhất. Tạo thư mục đã có metadata rồi rename nguyên tử vào tên khoá, tránh khoảng trống không biết chủ. PID chết được thu hồi và log `gỡ khoá bỏ lại`; khoá rỗng cũ chỉ thu hồi sau 10 phút; PID sống hoặc không thể xác định liveness thì giữ khoá. Không xoá đệ quy khoá; token riêng và thư mục không rỗng bảo vệ chủ thay thế khi các reaper chạy đồng thời.
- `Webstie/server/src/sale-ai/runtime.ts`: gộp lần khởi tạo đồng thời, tự thử lại sau 15 giây nếu thất bại. Log nguyên nhân đã che credential trong cấu hình/env, trường secret/token/password/API key và URL; không in stack/config. Dừng timer khi shutdown.
- `Webstie/server/src/routes/saleAiRoutes.ts`: HTML/JSON 503 báo trạng thái ngắn, riêng lỗi khoá báo đang thử lại; giữ no-store, CSP và tự tải lại trang.
- `Webstie/server/src/sale-ai/core.js`: shutdown chặn nhận công việc mới, chờ công việc đã nhận hoàn tất; thêm promise hoàn tất job nội bộ (không đưa vào JSON) và `waitForJob` cho kiểm thử.
- `Webstie/server/src/server.ts`: handler SIGINT/SIGTERM đóng nhận kết nối và chờ Sale AI tối đa 5 giây; writer tự nhả khoá qua finally. Nếu quá hạn, không cưỡng chế tháo khoá khi PID còn sống; log giới hạn, thoát và lần khởi tạo tiếp kiểm tra PID. Chỉ thêm handler, không gửi tín hiệu đến server thật trong lượt này.
- `Webstie/server/src/tests/saleAiUpdateAll.test.ts`: helper chờ đúng promise của job rồi GET kết quả một lần, bỏ polling 10ms theo thời gian thật; không tăng timeout. Giữ chờ thực của những ca kiểm tra ngắt kết nối/đồng thời khác. Thêm hai ca TASK-118 (null + rollback và giá 0 + retry), hiện tổng 17 ca.
- `Webstie/server/src/tests/saleAiRuntime.test.ts`: đồng hồ giả kiểm tra lần đầu lỗi, lần sau tự lên, không khởi tạo chồng, huỷ retry và che bí mật. `saleAiProxy.test.ts` cập nhật mock và assertion theo trạng thái 503 cụ thể mà spec yêu cầu.
- `Webstie/server/src/sale-ai/test/store-lock.test.js`: metadata, dead PID cả hai khoá, live PID, legacy TTL, drain timeout, reaper đồng thời và khởi tạo core offline với SplitStore sau khoá bỏ lại.
- `Webstie/server/src/sale-ai/test/background-update.test.js`: shutdown không nhận thêm job, job cũ hoàn tất và chờ qua completion promise.
- `tasks/TASK-117-runtime-check.cjs`: kiểm tra bổ sung runtime bằng TypeScript transpile + VM offline; tất cả dependency/timer được thay bằng stub trong script, không nạp cấu hình hay gọi mạng thật.

## Bằng chứng kiểm tra

Chạy từ `D:\Website_3Q` trừ khi ghi khác:

1. `node --test --test-isolation=none --test-name-pattern=TASK-117 Webstie/server/src/sale-ai/test/store-lock.test.js Webstie/server/src/sale-ai/test/background-update.test.js`: 8/8 đạt tại thời điểm trước khi thêm ca khởi tạo SplitStore.
2. `node --test --test-isolation=none Webstie/server/src/sale-ai/test/store-lock.test.js Webstie/server/src/sale-ai/test/retention.test.js`: 11/11 đạt (~0,87 giây), bao gồm khoá bảo trì từ chối writer sống.
3. Sau khi thêm ca SplitStore, `node --test --test-isolation=none Webstie/server/src/sale-ai/test/store-lock.test.js`: **8/8 đạt**, trong đó khởi tạo lại toàn bộ core offline qua cleanup đã gỡ khoá PID chết và lên thành công (~0,28 giây tổng).
4. `node tasks/TASK-117-runtime-check.cjs`: đạt retry, gộp khởi tạo, trạng thái sẵn sàng, shutdown huỷ timer và che bí mật. Đây là VM với timer giả, không phải kiểm chứng runtime tích hợp thật.
5. `node --test --test-isolation=none --test-name-pattern='TASK-117|TASK-118' Webstie/server/src/sale-ai/test/store-lock.test.js Webstie/server/src/sale-ai/test/background-update.test.js Webstie/server/src/sale-ai/test/joint-update.test.js Webstie/server/src/sale-ai/test/sapo.test.js`: 13/13 đạt tại thời điểm trước ca SplitStore; hai ca joint TASK-118 được chạy lại sau bổ sung kiểm tra giữ trạng thái bỏ qua khi phục hồi lượt gián đoạn: 2/2 đạt.
6. Tại `Webstie/server`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: đạt, exit 0.
7. `git diff --check`: đạt, chỉ cảnh báo chuyển LF/CRLF, không có lỗi whitespace.

## Sandbox và phần chưa xác minh

- `npx.cmd vitest run src/tests/saleAiRuntime.test.ts`: bị `spawn EPERM` khi esbuild tải cấu hình.
- Tại server, `$env:SALE_AI_E2E='1'; npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts src/tests/saleAiRuntime.test.ts src/tests/saleAiProxy.test.ts`: cũng bị `spawn EPERM` trước khi chạy test. Không chạy lặp 5 lần lệnh đã bị chặn cùng nguyên nhân. Không xin approval.
- Chưa xác minh E2E đạt 5 lần liên tiếp, xử lý tín hiệu của tiến trình thật/tsx watch hay giao diện trình duyệt. Claude cần kiểm tra các phần này ở môi trường cho phép subprocess.
- Không chạy full core suite in-process, không chạy full build/test thay Claude. Không gọi Kiot/Sapo thật, không in khoá, không stop/restart server, không commit. Giữ toàn bộ công việc chưa commit có sẵn.
- Không cưỡng chế mở khoá của PID sống, kể cả PID được hệ điều hành tái sử dụng; trường hợp đó tiếp tục báo bận để bảo vệ dữ liệu. Không dọn dữ liệu ngoài fixture tạm riêng của test.
