Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-139 — Tab Duyệt và chặn giảm dưới giá vốn

- Dự án: web (Sale AI) và BossTele.
- Người triển khai: Codex. Người kiểm tra độc lập: Claude.
- Trạng thái: `ready_for_review`.
- Ngày: 10/11/2026.
- Hành động gần nhất: triển khai trên nền TASK-137/138 đang chưa commit; bổ sung kiểm thử fake client, kiểm tra TypeScript và bàn giao.
- Bước tiếp theo: Claude chạy các lệnh chuẩn ngoài sandbox, kiểm tra trình duyệt desktop/mobile và review độc lập. Chưa đánh dấu `verified`.

## Thay đổi

1. `normalizeProduct` lấy giá vốn cao nhất lớn hơn 0 giữa các chi nhánh, không có thì `null`. Không đổi `kiot-fingerprint.js`.
2. `calculate` luôn mang `cost`; loại `missing_cost` và `p0_not_above_cost`; giá sale dưới vốn chuyển `needs_approval`. Lỗi tính toán đang chặn, ví dụ quyền sale lẻ VND, vẫn giữ `waiting`. POLICY mới: `baoq-2026-11-10-cost-approval-v12`, khiến bản chuẩn bị cũ không còn hợp lệ.
3. Bảng giá sale, bộ lọc M, phân trang và chọn tất cả bỏ các dòng chờ duyệt. Auto và cập nhật tay thông thường vẫn chỉ nhận `simulated`.
4. View `approval` có hai nhóm tìm kiếm/phân trang độc lập: Chờ duyệt và Đã lỡ giảm dưới vốn. Nhóm thứ hai chỉ nhận giá hiện tại khớp lần ghi đã xác minh của Sale AI, loại món đang chờ duyệt và món đã giữ đúng mức giá đó. Kể cả sản phẩm bị ẩn khỏi bảng sale thông thường vẫn có thể xử lý khi đủ điều kiện nhóm này.
5. `/api/kiot/prepare` và `/api/kiot/preview` nhận `approveBelowCost:true` hoặc `restoreCost:true`. Cờ duyệt chỉ nhận `needs_approval`; trả vốn chỉ nhận nhóm Đã lỡ. Luồng dùng lại prepare → xem bản chuẩn bị → xác nhận → commit, journal và xác minh hiện có, kể cả ghi chung Sapo khi đang bật. Metadata `approval:{kind,at,by}` được lưu trên prepared/update; `by` lấy ID người dùng runtime, không nhận từ body, thiếu thì `null`.
6. Cả ba engine preflight nhận trạng thái duyệt chỉ khi update có metadata phù hợp, giữ các kiểm tra policy/P0/M/giá/quyền sale/snapshot. Giá vốn mới khác snapshot thì dừng với thông báo yêu cầu tải lại và duyệt lại. Refresh nhận diện thay đổi chỉ ở vốn dù fingerprint không đổi. Không miễn duyệt vĩnh viễn ở mốc sau.
7. Trả về vốn ghi `cost`, không thay P0/M. Giá ghi đã xác minh được `expectedKiotPrices` hiện có nhận diện, không trở thành giá sửa tay trong lượt tự động tiếp theo.
8. `/api/kiot/keep-below-cost` chỉ lưu `belowCostKeeps:[{id,price,at,by}]` qua transaction của kho Sale AI, không PUT Kiot/Sapo. Request phải kèm snapshot giá/vốn đã hiện trong xác nhận; nếu thay đổi thì từ chối. Giá hiện tại khác giá đã giữ sẽ được xét lại.
9. Web có tab `Duyệt (n)`, lấy tổng hai nhóm từ API; lỗi lấy số thì bỏ số. Iframe có hai bảng, nút từng món/tất cả qua mọi trang theo tìm kiếm, hộp xác nhận số món/tổng tiền, khóa thao tác khi bận, hỗ trợ tìm tiếng Việt và giữ theme walnut. Lịch sử hiển thị nhãn Duyệt dưới giá vốn / Trả về giá vốn.
10. BossTele truyền vốn từ catalog hoặc bản lưu vào chính `calculate`; không sửa `telegram-bot.js` vì nhánh caption không phải `simulated` đã đúng. Test kiểm tra cả chờ duyệt và hai lý do loại mới.

## File thuộc TASK-139

- Kế hoạch: `tasks/TASK-139-plan.md`; báo cáo này.
- Frontend: `Webstie/frontend/src/price-system.tsx`.
- BossTele: `Webstie/BossTele/sale-price.js`, `test/sale-price.test.js`, `test/telegram-bot.test.js`.
- Dưới `Webstie/server/src/sale-ai/`:
  - `core.js`.
  - Thêm `lib/approval.js`.
  - Sửa `lib/kiot.js`, `lib/pricing.js`, `lib/live.js`, `lib/view-data.js`, `lib/batch-update.js`, `lib/batch-joint.js`, `lib/joint-update.js`, `lib/journal-storage.js`, `lib/update-report.js`, `lib/samples.js`, `lib/fake-sync.js`.
  - Sửa `public/app.js`, `public/live-ui.js`, `public/index.html`, `public/style.css`.
  - Thêm `test/below-cost.test.js`, `test/approval.test.js`, `test/approval-api.test.js`, `test/approval-ui.test.js`.
  - Bổ sung fixture/kỳ vọng phiên bản tại: `auto-table.test.js`, `auto-update.test.js`, `background-update.test.js`, `batch-joint.test.js`, `batch-speed.test.js`, `batch-update.test.js`, `cycle.test.js`, `fifteen-days.test.js`, `hidden-before-july.test.js`, `joint-update.test.js`, `journal-storage.test.js`, `jul-batch.test.js`, `kiot-batch-runtime.test.js`, `kiot-price-only.test.js`, `live-timing.test.js`, `live.test.js`, `note-first.test.js`, `preoct-m1.test.js`, `review-store-integrity.test.js`, `runtime-fatal.test.js`, `sapo-auto-refresh.test.js`, `sapo-rate-limit.test.js`, `shared-catalog.test.js`, `simulator.test.js`, `split-store.test.js`, `start-date.test.js`, `view-performance.test.js` (đều trong `test/`).

Các thay đổi có sẵn của TASK-137/138, gồm lịch/auto-update, runtime và test proxy/runtime, được giữ lại. Không đổi công thức M, quyền sale, lịch tự động; không sửa `shared/**`, `server/src/v2/**`, `server/src/services/**`. Không commit hoặc đổi nhánh.

## Fixture và kỳ vọng kiểm thử

- Fixture công thức cũ thêm vốn mẫu nguyên dương nhỏ để tiếp tục kiểm tra đúng công thức, lịch, batch và journal trước đây. Đây chỉ là dữ liệu test/mẫu; không suy diễn giá vốn cho sản phẩm thật.
- Các test mới dùng mức vốn/giá mẫu cụ thể để kiểm tra vượt vốn, bằng vốn, thiếu vốn, vốn đổi lúc preflight, giả mạo cờ/by, hai nhóm, duyệt lại ở mốc sau, giá sửa tay và giữ giá bị stale.
- Những assertion khóa POLICY cập nhật sang v12 theo thay đổi chính sách bắt buộc: `fifteen-days`, `note-first`, `preoct-m1` và BossTele `sale-price`.
- Một xung đột không thể giữ nguyên kỳ vọng cũ: case P0 = 1 đồng trong `simulator.test.js` trước đây đòi `simulated`. Với vốn nguyên dương tối thiểu 1 đồng, quy tắc mới bắt buộc `excluded/p0_not_above_cost`. Chỉ nhánh này đổi kỳ vọng sang loại món; các assertion công thức cho giá khác giữ nguyên. Có comment nêu lý do tại test. Không nới timeout hoặc bỏ assertion để che lỗi.
- Có review code chỉ đọc nội bộ; đã sửa các finding về nút/tiêu đề, lỗi làm tròn, xác nhận giữ giá stale và snapshot của món bị ẩn. Đây không phải review độc lập của Claude.

## Kiểm tra thực tế

- `npm.cmd run build` tại `Webstie`: **blocked**. Build server và TypeScript frontend đã chạy; Vite/esbuild bị `spawn EPERM` khi tải config.
- `npm.cmd test` tại `Webstie`: **blocked**, Node test runner của shared không tạo được tiến trình con (`spawn EPERM`); không suy ra frontend/server Vitest đã đạt.
- `node --test *.test.js` tại `server/src/sale-ai/test`: **blocked** (`spawn EPERM`).
- `npm.cmd test` tại BossTele: **blocked** (`spawn EPERM`).
- Sale AI cùng tiến trình: lượt cuối đầy đủ `node --test --test-isolation=none *.test.js` báo **367/367 đạt**, **`NODE_EXIT=0`**, khoảng 184 giây; gồm ca 1.500 sản phẩm và benchmark 5.000 sản phẩm giả lập. Lượt này chạy sau sửa cuối. Do PowerShell có thể biến stderr thành `NativeCommandError` khi test cleanup cố ý ghi cảnh báo, lượt cuối tách stdout/stderr và lấy riêng `$LASTEXITCODE`, rồi `exit` đúng mã Node. Đã chạy riêng test cleanup đó: 1/1 đạt, `NODE_EXIT=0`. Không che cảnh báo hoặc sửa test.
- Nhóm bốn file mới sau sửa cuối: **26/26 đạt**, exit 0. Có API in-process, fake Kiot/Sapo, SSR nút tab và DOM giả cho preview/xác nhận/huỷ/khóa nút. Không phải kiểm tra trình duyệt.
- Lượt cùng tiến trình loại hai ca tải lớn bằng `--test-skip-pattern`: **364 đạt, 0 lỗi** trước sửa nhỏ cuối; không tính là full acceptance.
- BossTele `node --test --test-isolation=none test/sale-price.test.js test/telegram-bot.test.js`: **29/29 đạt**.
- BossTele cùng tiến trình trừ `test/add.test.js`: **84/84 đạt**, exit 0. Lượt gồm cả file đó trước khi bổ sung 2 test mới: **83 đạt / 29 lỗi**, toàn bộ lỗi ở CLI `add.test.js` do `spawnSync ... EPERM`; không sửa test CLI.
- Frontend: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: **đạt**, exit 0.
- Server: `node ../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: **đạt**, exit 0. Lần đầu dùng đường dẫn `server/node_modules/typescript` không tồn tại; đã chạy lại bằng dependency workspace hiện có, không cài thêm package.
- `git diff --check`: **đạt**.
- Detector giao diện báo 2 cảnh báo border ở CSS có sẵn (dòng 1/15); giữ nguyên ngoài phạm vi.
- Playwright: Chromium bundle chưa có; thử Chrome đã cài bị **`spawn EPERM`**. **Chưa có ảnh chụp, kiểm tra desktop/mobile hoặc bằng chứng trình duyệt qua đăng nhập web**. Không cài trình duyệt/package.

## Giới hạn và bàn giao

- Không gọi ghi Kiot/Sapo thật, không bật bot/lịch, không restart web, không sửa kho sản phẩm thật. Mọi thao tác ghi kiểm thử chạy trên client/store giả hoặc thư mục tạm.
- Sau triển khai cần tải lại Kiot để bản lưu cũ có trường vốn mới và chạy lại bảng theo POLICY v12. Không tự bịa vốn cho bản lưu thiếu thông tin.
- Claude cần chạy lại build, test website, lõi và BossTele bằng lệnh chuẩn, rồi kiểm tra UI hai nhóm, hủy/xác nhận, tìm kiếm/phân trang và giao diện walnut ở desktop/mobile trên fixture. Không dùng báo cáo này làm bằng chứng đã ghi giá thật.

## Bổ sung sau review Claude — phát hiện 1–3 (10/11/2026)

Máy: Laptop (DESKTOP-4G5GOSR). Trạng thái phần bổ sung: `ready_for_review`; chưa được Claude kiểm tra lại.

- Tab thành `Bảng giá sale | Lịch sử | Duyệt (n)` trong `Webstie/frontend/src/price-system.tsx`.
- `public/index.html` thêm ID cho mô tả page-header; `public/app.js` đặt câu "Món giảm xuống dưới giá vốn: chỉ ghi lên Kiot khi bấm Duyệt." riêng cho approval, khôi phục mô tả mặc định ở view khác. `public/live-ui.js` bỏ dòng mô tả trùng.
- Hai nhóm dùng ô `money approval-loss` có dấu `-` trước số tiền; `public/style.css` đặt màu `#a3341f`, độ đậm `600`. Nút Trả về giá vốn từng món/tất cả dùng `primary`; Giữ giá giữ kiểu phụ. Không đổi handler, logic tiền, server hay kỳ vọng test; test UI không khóa text/thứ tự cũ nên không sửa.
- `node --test --test-isolation=none approval-ui.test.js approval.test.js approval-api.test.js below-cost.test.js` tại thư mục test Sale AI: **26/26 đạt**, exit 0, client/store giả lập.
- Self-check Node qua stdin: SSR thứ tự tab; mô tả khi chuyển approval → results → approval → history; render hai ô lỗ có dấu trừ; class restore/keep; bỏ mô tả trùng và CSS màu/độ đậm: **đạt**, exit 0. Lần đầu PowerShell chuyển tiếng Việt trong stdin thành `?` làm assertion không đạt; chạy lại với `$OutputEncoding` UTF-8 đã đạt.
- `node --check` cho `public/app.js`, `public/live-ui.js` và `git diff --check`: **đạt**. Detector Impeccable còn cảnh báo nhãn SALE AI 10px/eyebrow và border có sẵn; giữ nguyên ngoài phạm vi.
- `npm.cmd run build` tại `Webstie`: **blocked**, exit 1 do Vite/esbuild `spawn EPERM`; build server và TypeScript frontend đã qua. `npm.cmd test` tại đây: **blocked**, exit 1 vì 7 file shared không spawn được tiến trình con; frontend/server chưa chạy qua lệnh này. Không coi là full acceptance.
- Chưa kiểm chứng trực quan desktop/mobile trên trình duyệt cho phần bổ sung. Không ghi Kiot/Sapo thật, không restart, không bật bot/lịch, không commit; bảo toàn thay đổi có sẵn.
