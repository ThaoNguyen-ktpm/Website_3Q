Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-120 — Kết quả triển khai

- Dự án: web / Sale AI.
- Người thực hiện: Codex; Claude kiểm tra độc lập.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: bật ghi lô Kiot trong runtime, sửa phục hồi món chưa gửi, thêm test tập trung và chạy typecheck.
- Bước tiếp theo: Claude review, chạy build/toàn bộ test và E2E 5 lần theo spec. Chưa ghi `verified`.

## Thay đổi riêng TASK-120

- `Webstie/server/src/sale-ai/runtime.ts`: thêm `batchWrites:true` vào `createSaleAi`; giữ `sapoWrite:false`, `kiotDescription:false` của TASK-119. Đây là cấu hình trong source; không phát lệnh dừng hay khởi động lại server để áp dụng.
- `Webstie/server/src/sale-ai/lib/service.js`: khi phục hồi lượt `joint-v1` đang chạy, platform `ready` có `requestSent !== true` chuyển `not_sent`, thông báo **“Chưa gửi — lượt bị dừng”**, `requestSent:false`. `sending` kể cả thiếu/false requestSent vẫn `unknown`; `ready` đã có requestSent true cũng `unknown`. Món có tất cả platform chưa gửi mang trạng thái tổng `not_sent`; snapshot attempt lưu đúng kết quả. Giữ platform done, lỗi kiểm tra, lỗi ghi và các trạng thái cuối sẵn có. Summary chỉ có platform thực sự trong journal, không tự thêm Sapo cho lượt Kiot. Không đổi phân loại ready của `restore-joint-v1` hay các nhánh hoàn tác cũ.
- `Webstie/server/src/sale-ai/test/kiot-batch-runtime.test.js`: 10 ca kiểm tra cấu hình runtime, batch 1.311 món, fingerprint, lỗi PUT, xác minh giá/mô tả/thiếu món, recovery và tiến độ UI.
- `tasks/TASK-120-plan.md`: kế hoạch triển khai.

Repo có nhiều thay đổi chưa commit từ trước (bao gồm TASK-119). Diff so với HEAD chứa cả các task đó; TASK-120 chỉ sửa hai file ứng dụng nêu trên và thêm test/tài liệu riêng. Không đổi dependency hay dữ liệu lưu thật. `TASK-119-review.md` không có trên đĩa; đã đọc result và theo xác nhận của Bảo rằng TASK-119 đã được verified.

## Cơ chế có sẵn được giữ nguyên và kiểm tra

- `LOT_SIZE=50` giữ nguyên. Không tra tài liệu Kiot trực tuyến trong lượt này; không khẳng định đã xác minh giới hạn endpoint trên dịch vụ thật.
- Lượt `localOnly`: `executeBatchJoint` gọi `client.all()` **một lần tại cửa gửi trước vòng lô**, so fingerprint với snapshot xác nhận. Sau đó `listModified` dùng cursor và biên 30 giây để kiểm tra/xác minh; dữ liệu đọc lại lô trước cũng phát hiện thay đổi của các món lô sau. `client.all` runtime hiện đi qua `catalogStore.sync()` và danh mục Kiot đầy đủ; không thêm quét toàn danh mục cho mỗi lô.
- Fixture 1.311 món ghi đúng **27 PUT lô (26 × 50 + 11)**, không PUT đơn, không GET từng món, không Sapo; 1 lần all tại bước commit và 28 lần listModified (một đối chiếu đầu, 27 xác minh). Client giả có độ trễ mô hình và nhường event loop mỗi request; đây không phải đo tốc độ Kiot thật hay đo hiệu năng ổ đĩa sản xuất.
- Body qua engine chỉ có `basePrice`; adapter thật thêm các trường nhận dạng đã có và bỏ `description`. Test TASK-119 với `KiotClient` thật/fetcher giả kiểm tra JSON body đơn/lô được chạy lại.
- Đọc lại phải đúng giá và mô tả gốc. Sai giá, đổi mô tả hoặc thiếu món chỉ làm món đó `unknown`; không tự gửi lại. 503/timeout làm cả lô `unknown`, lô kế tiếp vẫn chạy trong chế độ continueOnError.
- Tiến độ `public/app.js` đã có `Ghi và xác minh lô 5/27` cùng `230/1.311`; test gọi hàm renderProgress bằng VM đã đạt. Không sửa UI hoặc thêm layout; chưa kiểm tra trình duyệt thật.
- Giữ quy tắc giá/POLICY, luồng nền và khóa. Hoàn tác vẫn dùng bộ máy từng món, được chạy lại trong test chỉ giá Kiot.

## Bằng chứng kiểm tra

Tất cả client/fetcher trong test là fixture riêng, store bộ nhớ; không gọi Kiot/Sapo thật, không đọc/in giá trị khóa.

1. Tại repo, `node --test Webstie/server/src/sale-ai/test/kiot-batch-runtime.test.js`: bị sandbox chặn **spawn EPERM** trước khi test chạy. Không xin quyền.
2. Trước sửa ứng dụng, `node --test --test-isolation=none Webstie/server/src/sale-ai/test/kiot-batch-runtime.test.js`: **8 đạt, 2 thất bại**, đúng tại cờ runtime chưa bật và ready bị phục hồi thành unknown.
3. Sau sửa, tại repo:

   ```powershell
   node --test --test-isolation=none Webstie/server/src/sale-ai/test/kiot-batch-runtime.test.js Webstie/server/src/sale-ai/test/kiot-price-only.test.js Webstie/server/src/sale-ai/test/joint-update.test.js Webstie/server/src/sale-ai/test/background-ui.test.js
   ```

   **46/46 đạt, 0 thất bại**, exit 0, khoảng 4,3 giây theo test runner. Chỉ chạy các file liên quan, không chạy full core suite in-process.
4. Tại `Webstie/server`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: **đạt**, exit 0.
5. Tại `Webstie/server`: `$env:SALE_AI_E2E='1'; node ../node_modules/vitest/vitest.mjs run src/tests/saleAiUpdateAll.test.ts`: **bị chặn spawn EPERM**, esbuild không tạo được subprocess khi nạp vitest.config.ts. Không test E2E nào chạy, không lặp thêm 5 lần khi cùng điều kiện chặn.
6. Hai lần gọi tsc/vitest ban đầu dùng `server/node_modules/...` trả `MODULE_NOT_FOUND`; đã sửa sang `../node_modules/...` vì dependency được hoist tại `Webstie/node_modules`. Không cài thêm package.
7. `node --check` cho `lib/service.js` và test mới: đạt. `git diff --check`: đạt, chỉ cảnh báo chuẩn hóa LF/CRLF tại các file sẵn có.

Rà soát nội bộ bằng agent chỉ đọc theo skill `requesting-code-review`: không phát hiện lỗi Critical/Important trong phạm vi TASK-120. Reviewer không chạy test hay gọi mạng. Trạng thái `journaled` bị gián đoạn trước checkpoint ready vẫn unknown theo hành vi cũ; spec lần này chỉ yêu cầu phân loại lại ready, nên không mở rộng thay đổi.

Kiểm tra tập trung in-process và typecheck không thay thế build, suite đầy đủ, E2E hay xác minh trên shop thật. Claude chạy `npm run build`, `npm test` tại Webstie; full core Sale AI; E2E fixture 5 lần và BossTele `npm test` theo spec.

## Rủi ro và giới hạn

- Theo đặc tả, `PUT /listupdatedproducts` chưa từng chạy trên Kiot thật. Lượt thật đầu tiên Bảo nên chọn **3–5 món trong một lô**, xem giá và mô tả trên Kiot trước khi chạy hàng nghìn món. Phiên này không thực hiện lượt thật.
- Một lỗi mạng khi gửi lô có thể làm tối đa **50 món `unknown`**. Cần dùng “Cập nhật lại các món lỗi” theo bước xác nhận của Sale AI hoặc kiểm tra tay; không có resend tự động cho PUT không rõ kết quả.
- Không dừng/khởi động lại server, không bật bot, không commit; chưa xác minh cấu hình mới đã được tiến trình đang chạy nạp. Không chạy build/toàn bộ website/core/BossTele tests theo phân công Claude và chỉ dẫn của Bảo.
