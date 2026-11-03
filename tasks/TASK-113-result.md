Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-113 — Giới hạn tốc độ Sapo và xử lý HTTP 429

- Dự án: web / Sale AI.
- Người thực hiện: Codex. Người kiểm tra độc lập tiếp theo: Claude.
- Ngày: 02/11/2026.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai, thêm kiểm thử bằng client giả và đồng hồ giả, rà soát lỗi phân loại kết quả sau ghi.
- Bước tiếp theo: Claude chạy lại các lệnh bị sandbox chặn, review và kiểm tra giao diện trên môi trường được phép; chưa xác nhận hành vi trên shop thật.

## Phạm vi đã triển khai

1. `Webstie/server/src/sale-ai/lib/sapo.js`
   - Mọi SapoClient mặc định dùng chung một hàng đợi trong tiến trình. Chỉ mục, đọc sản phẩm, PUT cập nhật và restore đều đi qua `request()`.
   - Giãn thời điểm bắt đầu yêu cầu ít nhất 500 ms, kể cả khi nhiều nơi gọi đồng thời. Giữ hàng đợi đến khi đã xử lý response để header của yêu cầu trước có hiệu lực với yêu cầu sau.
   - Đọc `X-Sapo-Api-Call-Limit`, hỗ trợ thêm `X-Sapo-Shop-Api-Call-Limit`; tên header không phân biệt hoa/thường. Khi mức dùng vượt 70% dung lượng báo về, chờ xả bớt trước khi gửi tiếp. Header thiếu/sai định dạng giữ nhịp mặc định.
   - GET 429: tối đa ba lần thử lại sau lần gọi đầu; tuân `Retry-After` dạng số giây hoặc HTTP-date; thiếu/sai header thì chờ 2, 4, 8 giây. Thời gian nghỉ áp dụng chung cho mọi yêu cầu đang chờ.
   - PUT 429: chỉ gửi một lần, trả `httpStatus:429`, `retryAfter`, `uncertain:false` và lỗi `Sapo quá giới hạn — chưa ghi`; yêu cầu Sapo tiếp theo phải chờ hết thời gian nghỉ.
   - Đồng hồ/hàm chờ có thể tiêm riêng trong test, không sửa biến môi trường hoặc cấu hình batch.
2. `Webstie/server/src/sale-ai/lib/joint-update.js`
   - Đọc Kiot/Sapo vẫn song song nhưng dùng kết quả riêng của từng bên; giữ nguyên điều kiện so sánh fingerprint.
   - Khi một bên kiểm tra thất bại, bên đó là `preflight_failed`; bên kiểm tra đạt là `not_sent`, không nhận lỗi đọc của bên kia. Cả món đó không được gửi; các món khác tiếp tục nếu `continueOnError:true`.
   - Giữ cơ chế dừng khi 401/403 hoặc lỗi nhật ký. Thêm thời gian nghỉ Sapo sau 429, không tự gửi lại PUT.
3. `Webstie/server/src/sale-ai/lib/batch-joint.js`
   - Dùng thông báo chờ Sapo đúng đặc tả, kiểm lại hạn nghỉ sau khi chờ để các lane tôn trọng thời gian nghỉ mới được kéo dài.
   - Phân biệt 429 của PUT bị từ chối với 429 của GET xác minh sau PUT thành công. Trường hợp sau là `unknown`, giữ nguyên thông tin đã gửi, không ghi nhầm “chưa ghi” và không tự gửi lại.
4. `Webstie/server/src/sale-ai/core.js`, `public/app.js`
   - `/api/status` bổ sung `sapoWait` để polling vẫn đọc được trạng thái trong lúc hàng đợi đang ngủ.
   - Khi đang chờ, giao diện polling hiển thị `Đang chờ giới hạn Sapo…` cùng số sản phẩm đã xử lý/tổng số; giữ chu kỳ polling hiện có.
5. Kiểm thử:
   - Thêm `Webstie/server/src/sale-ai/test/sapo-rate-limit.test.js`: chín ca, dùng core thật, ba store bộ nhớ riêng, adapter Sapo thật với fetch giả; không truy cập mạng.
   - Bổ sung ca 15 trong `Webstie/server/src/tests/saleAiUpdateAll.test.ts`: PUT Sapo 429 không gửi lại, nghỉ theo Retry-After, Kiot và các món còn lại tiếp tục. Giữ nguyên 14 ca hiện có.

Không thay quy tắc giá, nội dung fingerprint, mã `sapoSku`, thuật toán rollback, `SALE_AI_BATCH`, dependency hay cấu hình máy chủ. Các thay đổi có sẵn của TASK-112 trong core/test, AGENTS.md và CLAUDE.md được bảo toàn; diff của những file đó chứa cả công việc trước TASK-113.

## Bằng chứng kiểm tra

Tại `D:\Website_3Q\Webstie\server`:

- Trước sửa: bốn test tái hiện ban đầu đều thất bại đúng lỗi 429/không thử lại/gắn lỗi hai bên.
- `node --test --test-isolation=none src/sale-ai/test/sapo-rate-limit.test.js`: **9/9 đạt** trên bản sửa cuối.
  - Cập nhật 300 món qua core thật với bucket giả 40, xả 2/giây: 300 thành công phía Sapo, không có phản hồi 429 từ bucket; các yêu cầu liên tiếp cách nhau ít nhất 500 ms theo đồng hồ giả.
  - GET 429 rồi phục hồi; hết ba lần thử lại chỉ lỗi đúng món, không ghi món đó và không gắn lỗi Sapo vào Kiot.
  - PUT 429: đúng một lần gửi, báo chưa ghi, nghỉ rồi tiếp tục; kiểm cả engine từng món và batch fixture.
  - GET xác minh 429 sau PUT thành công: `unknown` ở cả hai engine, không gửi lại.
  - Hàng đợi dùng chung, chỉ mục/đọc/ghi/restore cùng nhịp; header bucket, HTTP-date, header sai/âm; core status và đoạn polling giao diện thật trong VM.
- `node --test --test-isolation=none src/sale-ai/test/*.test.js`: **214/214 đạt**, không skip, exit 0; lượt chạy cuối khoảng 59,7 giây. Đây là suite lõi chạy cùng tiến trình, không thay thế E2E website hoặc chế độ Node mặc định bị sandbox chặn.
- `node --test src/sale-ai/test/sapo-rate-limit.test.js`: **bị sandbox chặn `Error: spawn EPERM`**, chưa chạy được theo chế độ tạo tiến trình con thông thường.
- `$env:SALE_AI_E2E='1'; ..\node_modules\.bin\vitest.cmd run src/tests/saleAiUpdateAll.test.ts`: **bị sandbox chặn `spawn EPERM`** khi esbuild tải `vitest.config.ts`. Không khẳng định 14 ca cũ hoặc ca 15 mới đã đạt trong phiên này.

Tại `D:\Website_3Q\Webstie`:

- `npm.cmd run build --workspace server`: **đạt** trên bản sửa cuối, gồm TypeScript và sao chép JS/public Sale AI sang dist.
- `npm.cmd run build`: server build và frontend `tsc --noEmit` đạt; **frontend Vite build bị chặn `spawn EPERM`** ở esbuild khi tải `vite.config.ts`.
- `npm.cmd test`: **bị chặn `spawn EPERM`** khi Playwright tạo worker cho ba test frontend; vì script dùng `&&`, lượt này chưa chạy server Vitest hoặc lõi.
- `git diff --check`: đạt. `node --check` cho `sapo.js`, `joint-update.js`, `batch-joint.js`, `core.js`, `public/app.js`: đạt.

## Rà soát và giới hạn

- Có reviewer agent chỉ đọc theo skill `requesting-code-review`. Reviewer phát hiện lỗi gắn “chưa ghi” sau PUT thành công/GET xác minh thất bại; đã sửa và thêm regression test cho cả hai engine. Reviewer chạy lại chín test focused, không còn phát hiện cần sửa trong phạm vi đã review. Đây chưa phải review độc lập của Claude.
- **Tên header và dung lượng/rate limit thật chưa được xác nhận.** Đã tra nguồn công khai nhưng chưa tìm được tài liệu REST chính thức xác nhận chính xác hai tên header trên. Không gọi shop thật để lấy header theo chỉ thị của Bảo. Hai tên hiện được hỗ trợ phòng thủ; nhịp mặc định 2 yêu cầu/giây và `Retry-After` vẫn hoạt động khi không có header bucket. Bucket 40/2 là điều kiện mô phỏng của đặc tả, không phải kết luận về hạn mức thực tế.
- Bộ điều tiết chỉ dùng chung trong một tiến trình; các ứng dụng hoặc máy khác gọi cùng shop có thể vẫn gây 429, vì vậy vẫn cần nhánh xử lý 429.
- Kiểm tra giao diện bằng code polling thật trong VM; chưa có kiểm chứng trình duyệt. E2E Vitest/build frontend/toàn bộ website test chưa đạt bằng chứng do sandbox; Claude cần chạy lại ở môi trường cho phép.
- Không gọi Kiot/Sapo thật, không in khóa, không đọc `.env`, không khởi động/dừng/restart server hay bot, không commit. Chỉ build cục bộ và chạy fixture/test riêng.

## Bổ sung sau review — sửa timeout E2E ca 5 (02/11/2026)

Máy: Laptop (DESKTOP-4G5GOSR)

- Trạng thái: `ready_for_review`; chưa có kết quả Claude chạy lại E2E trên bản bổ sung này.
- Nguyên nhân xác nhận từ code: TASK-113 đổi `waitPause()` trong `batch-joint.js` từ chờ một lần sang vòng `while` kiểm tra lại hạn nghỉ, cần thiết khi lane khác kéo dài hạn nghỉ. Fixture `start()` của E2E vẫn trả ngày cố định từ `clock`, không tiêm `live.sleep`; sau mỗi lần ngủ thật 1 giây của Kiot 429, đồng hồ vẫn đứng trước `pauseUntil`, nên vòng chờ không kết thúc. Ca 5 dùng Sapo client giả, không đi qua limiter HTTP Sapo, nên limiter Sapo không gây timeout ca này.
- Chỉ sửa `Webstie/server/src/tests/saleAiUpdateAll.test.ts`: fixture có đồng hồ tiến được và `live.sleep` tăng đồng hồ đó; timestamp của `edit()` dùng cùng đồng hồ để `listModified()` vẫn tìm đúng sản phẩm sau thời gian nghỉ. Mọi ca dùng chung fixture này, ca 15 bỏ phần tự tiêm đồng hồ riêng và dùng chung `pauses`.
- Ca 5 giữ nguyên timeout **30.000 ms** và toàn bộ assertion cũ; thêm assertion `pauses === [1000]` để bắt lỗi không tuân Retry-After hoặc lặp chờ. Ca 15 vẫn kiểm tra chờ ít nhất 2.000 ms và không gửi lại PUT lỗi.
- Rà soát các chờ mới: Sapo spacing, bucket cooldown và GET backoff đều qua `SapoRateLimiter.sleep/now` có thể tiêm qua tham số `timing` của `SapoClient`; nghỉ ở hai engine dùng `service.sleep` và `service.clock`. Không thêm timer thật hoặc đổi logic chạy thật. Các timer trong E2E phục vụ kiểm tra request đang chạy/ngắt kết nối vẫn giữ nguyên vì không phải chờ rate limit.

### Bằng chứng bổ sung trong phiên này

- E2E nguyên bản trước sửa: `$env:SALE_AI_E2E='1'; ..\node_modules\.bin\vitest.cmd run src/tests/saleAiUpdateAll.test.ts -t '5\. Kiot rate limit'` tại `Webstie/server`: bị sandbox chặn **`spawn EPERM`** khi esbuild tải `vitest.config.ts`, chưa vào test.
- Kiểm tra trực tiếp bằng harness tạm `.task113-check.mjs` đặt trong `server/src/tests`, trích đúng hàm `start()` từ file E2E, chuyển TypeScript bằng dependency hiện có, dùng core thật và SplitStore tạm thật; không mở HTTP server, không gọi mạng. Harness đã xóa sau kiểm tra.
  - `node src/tests/.task113-check.mjs --baseline`: khôi phục trong bộ nhớ hai đặc điểm fixture lỗi (clock cố định, không tiêm sleep), dừng bằng watchdog riêng sau 5 giây, exit 1 vì ca 5 không hoàn tất. Đây là kiểm tra chẩn đoán riêng, không sửa timeout Vitest và không thay thế việc tái hiện timeout 30 giây qua HTTP.
  - `node src/tests/.task113-check.mjs`: exit 0; ca 5 qua core thật ghi Kiot 70/120, Sapo 120/120, ba lô, `pauses=[1000]`; ca 15 ghi Kiot 4/4, Sapo 3/4, không gửi lại món PUT lỗi và nghỉ theo đồng hồ giả ít nhất 2 giây. Đây là kiểm tra core với fixture E2E, **chưa phải E2E router website**.
- `node --test --test-isolation=none src/sale-ai/test/sapo-rate-limit.test.js`: **9/9 đạt**, không skip; bao gồm spacing, GET backoff, bucket cooldown, PUT 429 và cả hai engine bằng đồng hồ giả.
- `node --test --test-isolation=none src/sale-ai/test/*.test.js`: **214/214 đạt**, không fail/skip, exit 0, khoảng 167,7 giây. Ca 5.000 món đạt: 1.290 giây mạng mô phỏng + 153 giây xử lý thật, 249 GET Kiot, 100 lô. Đây là suite lõi cùng tiến trình, không thay thế E2E HTTP hoặc chế độ Node mặc định tạo tiến trình con.
- E2E đầy đủ sau sửa: `$env:SALE_AI_E2E='1'; ..\node_modules\.bin\vitest.cmd run src/tests/saleAiUpdateAll.test.ts`: vẫn bị sandbox chặn **`spawn EPERM`** khi tải config. Chưa xác nhận 15 ca E2E đạt.
- `npm.cmd run build` tại `Webstie`: server TypeScript/copy assets và frontend TypeScript đạt; Vite frontend bị sandbox chặn **`spawn EPERM`** khi tải `vite.config.ts`.
- `npm.cmd test` tại `Webstie`: Playwright frontend bị sandbox chặn **`spawn EPERM`** khi tạo worker; chuỗi `&&` chưa chạy server Vitest/lõi trong lệnh này.
- `git diff --check`: đạt, chỉ có cảnh báo chuyển LF/CRLF ở các file đã có thay đổi từ trước.

Không đổi dependency, timeout hoặc code production; bảo toàn các thay đổi TASK-112/113 có sẵn. Không restart server, không commit, không xin quyền và không gọi Kiot/Sapo thật. Claude cần chạy lại E2E đủ 15 ca ngoài sandbox trước khi xác nhận `verified`.
