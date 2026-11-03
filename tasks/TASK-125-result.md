Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-125 — Kết quả triển khai

- Dự án: web / Sale AI.
- Người thực hiện: Codex; ngày 02/11/2026.
- Trạng thái: `ready_for_review`. Đã sửa code và bổ sung test; chưa chạy test/build, chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: kiểm tra cú pháp, whitespace và rà luồng snapshot → đối chiếu → bỏ qua/ghi → tổng hợp → chọn lại.
- Bước tiếp theo: Claude chạy các kiểm tra trong spec, E2E 5 lần và review độc lập. Không dùng kết quả TASK-124 để xác nhận TASK-125 đạt.

## Thay đổi

1. `Webstie/server/src/sale-ai/lib/live.js`
   - Thêm kiểm tra snapshot dùng chung. Fingerprint khớp vẫn xử lý như trước. Trong chế độ chỉ giá, nếu giá đã bằng dự kiến thì chấp nhận khác biệt giá/thời điểm sửa khi tất cả trường khác trong fingerprint khớp; hoặc chấp nhận bản đọc khớp chính xác `afterProduct` của lần ghi Kiot `done` đã lưu trong nhật ký Sale AI. Không dùng giá đúng làm lý do bỏ qua thay đổi tên/mô tả/tồn kho/ID/mã/các trường khác.
   - Thông báo xung đột có giá hiện tại và giá dự kiến khi hai giá khác nhau; trường không nhận diện được ghi rõ “thông tin khác (tên/mô tả/tồn kho)”.
   - Đồng bộ sản phẩm từ bản đọc đã xác minh, kèm `liveReadAt`; snapshot bảng lấy thời điểm này. Dựng lại dòng có `liveBase`, `liveReadAt`, `currentPrice`, `notesBefore` mới cho luồng từng món, lô và luồng cũ. Giữ nguyên snapshot lịch sử và before-image của nhật ký.
   - Đồng bộ cả món đã đối chiếu và bỏ qua; không gắn nhãn đã ghi thành công cho món `unchanged`.
2. `lib/joint-update.js`, `lib/batch-joint.js`, `lib/batch-update.js` dưới cùng thư mục Sale AI:
   - Dùng kiểm tra snapshot chung tại cổng đối chiếu. Món đã đúng giá trong chế độ chỉ giá thành `unchanged`, `requestSent=false`, không PUT. Lượt chỉ có món bỏ qua vẫn có outcome `success`.
   - Lô cập nhật `operation.batch.unchanged`; tổng hợp phân biệt món bỏ qua với thành công có ghi. Không đổi kích thước lô, payload giá, bước đọc xác minh sau PUT, giới hạn/retry, khóa hay thuật toán phục hồi.
3. `lib/update-report.js`, `core.js`:
   - `unchanged` không tính lỗi, không tính `issueCount`, không đưa vào “Cập nhật lại các món lỗi”.
   - Chọn tất cả bỏ món đã đúng giá khi chỉ ghi giá Kiot; không đưa món này vào `excludedCodes` như món chưa đủ điều kiện. Chế độ cập nhật Sapo vẫn giữ khả năng chọn để xử lý Sapo.
4. `public/live-ui.js`:
   - Hiện “Đã đúng giá trên Kiot”, vô hiệu checkbox của món đó khi chỉ ghi giá Kiot; nút đếm theo danh sách chọn còn lại.
   - Chi tiết lịch sử hiển thị “Bỏ qua (đã đúng giá)”. Giữ bố cục, kiểu dáng và cơ chế escape hiện có. Áp dụng hướng dẫn Impeccable cho phần nhãn/trạng thái; không thiết kế lại giao diện.

## Test đã viết/cập nhật, chưa chạy

- `Webstie/server/src/sale-ai/test/kiot-price-only.test.js`: bổ sung 15 ca sinh theo chế độ ghi đơn/lô cho snapshot sau ghi, chọn lại không PUT, bảng/local cũ đối chiếu nhật ký đã xác minh, lẫn món đúng giá và món cần ghi, phục hồi chỉ món thực sự đã ghi, sửa tay giá/mô tả/tồn kho/rawFields vẫn `preflight_failed`, giao diện và nút đếm. Bổ sung assertion snapshot vào các ca hiện có cho ghi trực tiếp/nền và luồng cũ. Fixture nằm trong bộ nhớ, không tạo dữ liệu mẫu trên giao diện thật.
- `test/auto-table.test.js`: **cập nhật kỳ vọng có chủ đích theo yêu cầu 1 của TASK-125**: sau ghi thành công bảng phải có snapshot mới, thay cho kỳ vọng cũ bảng giữ nguyên và chọn lại báo xung đột. Giữ kiểm tra không tải lại danh sách và lịch sử không đổi.
- `test/batch-joint.test.js`: giữ assertion chặn sửa tay và không ghi; cập nhật kiểm tra câu lỗi để yêu cầu có lý do mô tả thay cho câu lỗi chung cũ, theo yêu cầu 4.
- `Webstie/server/src/tests/saleAiUpdateAll.test.ts`: thêm ca E2E cập nhật → đọc bảng mới → chọn tất cả → gửi lại món đúng giá → không PUT/không retry. Ca 13 nay yêu cầu selection chỉ còn món cần ghi, thay cho 59 món đúng giá vẫn được gửi tới prepare; số PUT mong đợi vẫn 61.
- `tasks/TASK-125-plan.md`: kế hoạch trước khi sửa ứng dụng.

## Kiểm tra thực tế và giới hạn

Theo yêu cầu mới nhất, **không chạy test suite hoặc build**. Không có bằng chứng red/green; không tuyên bố test mới/cũ, E2E hay build đạt.

- `node --check <file>` cho 10 file JS đã sửa: `core.js`, 5 file lib (`live`, `joint-update`, `batch-joint`, `batch-update`, `update-report`), `public/live-ui.js`, 3 test (`kiot-price-only`, `auto-table`, `batch-joint`): exit 0.
- `git diff --check -- <11 file JS/TS liên quan>`: exit 0.
- `impeccable.cmd detect --json Webstie/server/src/sale-ai/public/live-ui.js`: exit 0, kết quả `[]`. Đây chỉ là kiểm tra tĩnh, không thay thế xác minh giao diện bằng trình duyệt.
- Chưa typecheck file test TS, chưa chạy trình duyệt hoặc xác minh hành vi trên Kiot thật.
- Không có lệnh nào bị sandbox chặn; không yêu cầu approval. Một truy vấn `rg` dùng brace expansion kiểu Unix bị PowerShell báo lỗi cú pháp, đã chạy lại với danh sách đường dẫn tường minh. Một lần đọc nhầm đường dẫn `public/update-report.js` báo không tồn tại; module thật nằm tại `lib/update-report.js`, không tạo file thay thế.
- Đã đọc review TASK-124; working tree có sẵn nhiều thay đổi từ các task trước, được giữ lại. Diff tổng so với HEAD gồm cả công việc trước phiên này.
- Không gọi Kiot/Sapo thật; không đọc `.env`, không in khóa, không dừng/khởi động lại server, không bật bot, không commit. Không chủ động yêu cầu server nạp lại code.

## Lệnh bàn giao Claude

Tại `D:\Website_3Q\Webstie\server`, nhóm tập trung:

```powershell
node --test src/sale-ai/test/kiot-price-only.test.js src/sale-ai/test/auto-table.test.js src/sale-ai/test/batch-joint.test.js src/sale-ai/test/batch-update.test.js src/sale-ai/test/joint-update.test.js src/sale-ai/test/background-update.test.js src/sale-ai/test/update-report.test.js
```

Sau đó chạy đầy đủ theo spec:

- `D:\Website_3Q\Webstie`: `npm.cmd run build`, `npm.cmd test`.
- `D:\Website_3Q\Webstie\server\src\sale-ai\test`: `node --test *.test.js`.
- `D:\Website_3Q\Webstie\server`: đặt `$env:SALE_AI_E2E='1'`, chạy `npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts` **5 lần**, ghi kết quả từng lần; sau đó xóa biến môi trường test khỏi phiên nếu không cần dùng tiếp.
- `D:\Website_3Q\Webstie\BossTele`: `npm.cmd test`.

Chỉ ghi `verified` sau kiểm tra độc lập; hiện chưa xác nhận bản sửa đã đạt các tiêu chí hành vi bằng chạy test.

## Sua theo review

- Máy: Laptop (DESKTOP-4G5GOSR). Ngày 02/11/2026; Codex xử lý `tasks/TASK-126-review.md`. Trạng thái: `ready_for_review`, chưa được Claude kiểm tra lại. Phần này bổ sung bằng chứng mới, không thay bằng chứng lịch sử phía trên.
- `lib/live.js`: chốt lại `issueCount` sau khi tổng hợp kết quả cuối lô, trước công bố lượt hoàn tất. Test lẫn món đã đúng giá/món cần ghi xác nhận chỉ ghi món cần ghi, không đưa món `unchanged` vào lỗi/khôi phục. Review gọi đây là lỗi gửi lại; khi tái hiện, assertion hỏng thực tế là `issueCount` bị giữ từ checkpoint trước.
- Chỉ bộ cung cấp bảng đã gắn qua `sim.live` được công bố snapshot bảng mới. Simulator độc lập không có bộ cung cấp bảng giữ nguyên tham chiếu `runs`, blob lịch sử và số lần serialize như test yêu cầu; luồng web và các fixture đã gắn provider vẫn tạo snapshot mới với dữ liệu xác minh. Không sửa snapshot lịch sử tại chỗ.
- `lib/view-data.js`: API bảng trả thêm `liveReadAt`; `notesBefore` vẫn được giữ trong danh sách trường công khai, fingerprint nội bộ `liveBase` không được đưa ra API. Test mới chạy background update trên SplitStore ở temp, đọc API bảng và kiểm `currentPrice`, `notesBefore`, `liveReadAt`, chọn lại không PUT và không lỗi. E2E Express/Vitest chưa chạy được nên chưa xác nhận độc lập ca E2E trong review.
- `public/live-ui.js`: dựng query chọn tất cả bằng `encodeURIComponent` để handler dùng được cả trong biên DOM tối thiểu của test; giữ kiểm tra run/revision, cập nhật nhãn nút theo số món thật được chọn. Thêm tab “Đã đúng giá” và bộ lọc API `unchanged`; tab Sapo giá 0 chỉ hiện khi có món thuộc nhóm đó. Không đổi bố cục.
- Test cũ chỉ sửa hai regex câu lỗi trong `joint-update.test.js`: chấp nhận phần giải thích giá mới, vẫn bắt buộc “Kiot đã thay đổi”, lý do giá (và mã/tên ở ca tương ứng), cùng “bấm Tải lại từ Kiot”. Không sửa/nới assertion nào khác. Thêm `test/review-store-integrity.test.js`; test API dùng client giả trong fixture và kho tạm thật.

### Kiểm tra sau sửa

- Nhóm tập trung: `node --test --test-isolation=none` với `split-store`, `kiot-price-only`, `history-details`, `joint-update`, `journal-storage`, `auto-table`, `view-performance`, `review-store-integrity`: **78/78 đạt**, exit 0 (`TASK-126-review-focused-final.log`). Bốn regression cuối: **4/4 đạt** (`TASK-126-review-regression-final.log`). Nhóm storage/retention sau tối ưu audit: **25/25 đạt** (`TASK-126-review-storage-final.log`).
- `npm.cmd run build --workspace server` và frontend `npx.cmd tsc --noEmit -p frontend/tsconfig.json`: exit 0. Detector Impeccable trên `live-ui.js`: `[]`; kiểm cú pháp và `git diff --check` đạt. Đây không thay kiểm tra giao diện bằng trình duyệt.
- Lệnh chuẩn nhóm test và toàn bộ lõi `node --test ...` bị `spawn EPERM`. `npm.cmd run build` tại Webstie: server build/typecheck frontend qua, Vite frontend bị `spawn EPERM`. `npm.cmd test` tại Webstie bị Playwright worker `spawn EPERM` trước khi tới test server.
- E2E: đã thử `$env:SALE_AI_E2E='1'; npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts`; bị `spawn EPERM` khi esbuild nạp config, chưa chạy ca nào. Đã bỏ biến test sau lệnh. Không lặp lại năm lần cùng lỗi khởi tạo, không xin approval, không tuyên bố E2E đạt. Log: `TASK-126-review-e2e.log`.
- BossTele `npm.cmd test` bị `spawn EPERM`; phương án cùng tiến trình chạy 140 ca: **111 đạt, 29 lỗi do các ca `add.test.js` tự gọi `spawnSync ... EPERM`**. Không đổi test để né hạn chế. Log: `TASK-126-review-bosstele*.log`.
- Toàn bộ lõi: `node --test --test-isolation=none src/sale-ai/test/*.test.js` tại server kết thúc với **321/321 đạt, 0 lỗi, 0 bỏ qua**, 406.694 ms (`TASK-126-review-core-final.log`). Số ca khác lệnh có isolation vì các module test nhập lại fixture dùng chung chỉ được thực thi một lần. Không coi đây là thay thế kết quả 409 ca có isolation trong review. Shell trả exit 1 do cảnh báo stderr của ca cố tình gây lỗi dọn được PowerShell bọc thành `NativeCommandError`; chạy riêng `retention.test.js`, lưu/công bố `$LASTEXITCODE` rồi `exit` đúng mã Node cho **Node exit: 0** (`TASK-126-review-retention-exit.log`). Không gán exit 0 cho lệnh toàn bộ đã trả exit 1. Sau thay đổi cuối chỉ tránh duyệt lại chỉ mục audit trùng, nhóm storage/retention 25/25 và regression 4/4 được chạy kiểm tra riêng.
- Không gọi Kiot/Sapo thật, không in khóa, không restart/stop server, không bật bot, không commit. Không đọc/dọn/xóa `server/data`; chỉ sao chép backup được chỉ định sang temp cho kiểm tra TASK-126.
