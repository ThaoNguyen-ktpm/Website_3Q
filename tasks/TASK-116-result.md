Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-116 — Kết quả triển khai

- Dự án: web / Sale AI.
- Người thực hiện: Codex. Kiểm tra độc lập tiếp theo: Claude.
- Trạng thái: `in_progress` — code đã triển khai, đang chờ kết thúc test lõi dài.
- Hành động gần nhất: bổ sung test nền, kiểm tra lỗi fingerprint/batch/rollback và polling.

## Thay đổi

- `Webstie/server/src/sale-ai/core.js`: thêm `POST /api/kiot/update` nhận `runId`, `codes`, `excludedCodes`, `confirmed:true`, trả 202 và ID công việc trước khi thực thi. Khóa dùng chung giữ xuyên suốt chuẩn bị và ghi; lượt khác nhận 409. `GET /api/jobs/:id` trả trạng thái/kết quả/lỗi. `/api/status` và `/api/view` có metadata lượt nền; lịch sử vẫn ở kho hiện có. Giữ tối đa 7 kết quả công việc trong bộ nhớ.
- Các API có thao tác mạng dài (refresh, diagnose, Sapo check/mapping, preview, prepare/commit cũ và restore) cũng nhận công việc nền. API mới không phụ thuộc kết nối của trang. Không tự thử lại PUT.
- `lib/live.js`: chế độ `localOnly` chỉ dùng policy/P0, bảng hiện hành, fingerprint Kiot đã tải và đối chiếu SKU trong chỉ mục Sapo. Không GET món hay tải danh sách trong chuẩn bị mới. Thay thế prepared cũ; sau khi journal nhận snapshots, bỏ bản prepared nền đã dùng để tránh nhân đôi dữ liệu khi checkpoint.
- `lib/joint-update.js`: lượt nền đọc cặp Kiot/Sapo một lần trước ghi từng món; hai worker cùng tiến qua từng món để bản đọc không nằm chờ sau hàng nghìn món khác. Kiot fingerprint không khớp hoặc đối chiếu một bên lỗi thì không gửi cả hai bên cho món đó. Khi một bên bị dừng do quyền, bên còn lại tiếp tục; không deadlock. Giữ xác minh GET sau PUT, phân loại unknown khi mất phản hồi và cơ chế dừng/429 hiện có. Lỗi đọc đối chiếu được báo là lỗi kiểm tra.
- Chỉ mục Sapo hiện chỉ lưu ID/SKU, không có nội dung/giá đầy đủ. Snapshot đầy đủ và fingerprint Sapo của lượt nền được lấy tại cổng ghi, lưu trước PUT, sau đó GET xác minh. Luồng xác nhận cũ vẫn giữ so fingerprint với snapshot chuẩn bị cũ.
- `lib/batch-joint.js`: với localOnly, kiểm tra danh sách Kiot hiện tại trong engine ghi, rồi giữ kiểm tra modified-since từng lô. Điều này chặn cả chỉnh sửa bên ngoài cũ hơn cửa sổ 30 giây. Snapshot Sapo lưu trước PUT. Không bật batch sản xuất.
- `lib/restore.js`: cho phép món chưa từng gửi Sapo thiếu snapshot đầy đủ; chỉ các thay đổi đã xác minh mới có tác vụ khôi phục như trước.
- `public/live-ui.js`, `public/app.js`: cả cập nhật đã chọn và cập nhật lại món lỗi dùng một POST xác nhận; API client chờ bằng GET ngắn. Hiển thị tiến độ cả engine từng món và engine lô, chờ giới hạn Sapo, rồi tóm tắt TASK-114 và tải lại màn hình/lịch sử. Tải lại trang vẫn tìm thấy lượt đang chạy hoặc kết quả vừa xong. Không thêm hộp hỏi.
- `Webstie/server/src/server.ts`: đặt `requestTimeout=30000`, `headersTimeout=15000`, socket inactivity timeout 30000 ms; không tắt timeout.

Không sửa quy tắc giá, P0, ngày 01/07, ngưỡng 600 triệu hoặc rate limiter TASK-113. Giữ nguyên các thay đổi TASK-112–115 có sẵn, kể cả các file đang sửa/xóa trước phiên này.

## Kiểm thử và bằng chứng

- Thêm `test/background-update.test.js`, `test/background-ui.test.js` và helper `test/job-result.js`. Chỉnh helper chờ 202 trong `auto-table.test.js`, `hidden-before-july.test.js`, `sapo-auto-refresh.test.js`, `src/tests/saleAiUpdateAll.test.ts`; cập nhật VM fixture trong `sapo-rate-limit.test.js` và kỳ vọng API mới trong `simulator.test.js`. Các tiêu chí giá, 429, quyền, khóa, snapshot và rollback cũ giữ nguyên.
- TDD: 3 ca đầu của `background-update.test.js` chạy trước triển khai đều thất bại vì API mới trả 404 thay vì 202/400. Sau đó triển khai API và kiểm tra lại.
- `node --test --test-isolation=none src/sale-ai/test/hidden-before-july.test.js src/sale-ai/test/sapo-auto-refresh.test.js src/sale-ai/test/auto-table.test.js src/sale-ai/test/joint-update.test.js src/sale-ai/test/batch-joint.test.js`: **58/58 đạt**; gồm ca 5.000 món, rollback, fingerprint, giới hạn 429, journal và tự đọc Sapo.
- 5 ca nhỏ của `background-update.test.js` trên code cuối hiện tại: **5/5 đạt** — retry, lỗi nền giải phóng khóa, batch chặn chỉnh sửa Kiot cũ, một nền tảng bị 403 không kẹt barrier, rollback kết quả thành công một phần dù món chưa gửi thiếu snapshot Sapo.
- `node --test --test-isolation=none src/sale-ai/test/background-ui.test.js`: **2/2 đạt** — client chờ 202 bằng GET, không gửi xác nhận lại; báo lỗi nền mà không thử PUT lại. Đây là test hàm API trong VM, không phải browser E2E.
- Ca 1.500 món đã đạt: API trả 202 dưới 1 giây thực, busy/409 và kết quả lịch sử đúng, mỗi món chỉ một GET trước PUT trên mỗi nền tảng. Lượt chạy riêng sau khi bổ sung đối chiếu cặp mất khoảng 392 giây thực; hai bộ test dài chạy đồng thời nên không dùng số này dự báo tốc độ thật.
- Lượt bộ lõi đầu: **219/221 đạt**, hai lỗi fixture được sửa: VM test polling cần khai báo trạng thái mới; test HTTP cũ mong API `/api/kiot/update` không tồn tại, nay kiểm tra 400 khi thiếu xác nhận và state không đổi. Chạy lại hai file: **22/22 đạt**. Đây là thay đổi test có chủ đích theo API mới trong spec, không bỏ kiểm tra an toàn.
- Bộ lõi cuối đang chạy trên code đã sửa đầy đủ: `tasks/TASK-116-core-tests-final.log`. Log lượt trước giữ ở `tasks/TASK-116-core-tests.log`.
- `npx.cmd tsc --noEmit -p tsconfig.json` tại server: đạt. `node --check` các file JS đã sửa: đạt. `git diff --check`: đạt (chỉ cảnh báo chuyển LF/CRLF).

## Lệnh bị sandbox chặn

- `node --test src/sale-ai/test/background-update.test.js`: `Error: spawn EPERM` khi tạo tiến trình test. Dùng `--test-isolation=none` để kiểm tra trong tiến trình, không coi đây là E2E.
- `npm.cmd test` tại `Webstie`: Playwright frontend không tạo được worker, `spawn EPERM`; chuỗi test gốc chưa chạy qua.
- `$env:SALE_AI_E2E='1'; npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts` tại server: esbuild không khởi động được, `spawn EPERM`. Helper E2E đã chỉnh chờ 202 trước kiểm tra kết quả; giữ 15 ca và tiêu chí nghiệp vụ, chưa xác nhận 15/15 trên bản mới.
- `npm.cmd run build` tại `Webstie`: server TypeScript và copy Sale AI đạt; frontend TypeScript đạt, Vite build bị `spawn EPERM` khi load cấu hình. Chưa đạt full build.
- Lệnh đọc metadata tiến trình `Get-CimInstance Win32_Process` bị `Access denied`; không thử nâng quyền hoặc can thiệp tiến trình nào.

## Giới hạn và bước tiếp theo

- Không gọi Kiot/Sapo thật, không đọc/in khóa, không dừng/khởi động lại server đang chạy, không commit. Không dùng kho thật để chạy test ghi/khôi phục.
- Công việc chạy trong tiến trình máy chủ hiện có; đóng/tải lại trang không cắt lượt. Nếu tiến trình máy chủ bị tắt, cơ chế journal gián đoạn hiện có áp dụng; không tự gửi tiếp PUT. Kết quả job trong bộ nhớ không thay thế lịch sử bền vững.
- Lưu snapshot Sapo mới trước từng PUT làm tăng số checkpoint; cần Claude quan sát thời gian thực trên máy được phép. Không suy ra tốc độ ghi thật từ fixture.
- Claude cần chạy lại `npm test`, full build và E2E 15 ca trong môi trường cho phép spawn, rồi kiểm tra giao diện tiến độ/Lịch sử sau tải lại trang. Chưa được Claude kiểm tra độc lập.
