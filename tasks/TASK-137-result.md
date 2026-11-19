Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-137 — Kết quả triển khai

- Dự án: web / Sale AI. Người thực hiện: Codex.
- Trạng thái: `ready_for_review` — đã triển khai, chưa được Claude chạy test/review độc lập; không ghi `verified`.
- Hành động gần nhất: bổ sung lịch, API, giao diện, Lịch sử, test fixture và tài liệu; kiểm tra cú pháp và diff.
- Bước tiếp theo: Claude chạy các kiểm tra theo đặc tả, bao gồm E2E 5 lần và QA trình duyệt.

## Thay đổi

1. `runtime.ts` kiểm tra lịch cạnh `keepCurrent` mỗi 15 giây, cả sau khởi tạo. Chỉ truyền quyền chạy khi `process.env.SALE_AI_AUTO_UPDATE === '1'`; không đọc/sửa file môi trường trong phiên triển khai. Mặc định công tắc Tắt, 10:00, giờ Việt Nam, Thứ 2–Thứ 7.
2. Cửa sổ chạy **[giờ đã cài, giờ đã cài + 5 phút)**. Bỏ giờ ngoài cửa sổ, bỏ Chủ nhật. Lưu ngày nhận lượt trước mọi đọc/ghi Kiot; sau khởi động lại hoặc đổi giờ không chạy lại ngày đó. `nextAt` tính bằng múi giờ Việt Nam, không theo múi giờ máy.
3. Cài đặt và ngày nhận lịch lưu tại `server/data/sale-ai/auto-update.json`, bằng `Store` hiện có, tuần tự hoá ghi. Kho riêng cho phép ghi Lịch sử bỏ qua do bận mà không sửa draft nhật ký đang ghi giá. Các ghi này vẫn được theo dõi trong hàng đợi ghi khi shutdown/interrupt. Không tạo dữ liệu sản xuất trong phiên này.
4. Nhận lịch bằng **cùng `startJob('update')`/khoá nền** với thao tác tay. Sau đó tải Kiot, `ensureCurrent(real)`, chọn mọi trang, chỉ M1–M6 đủ điều kiện có giá khác dự kiến, rồi dùng `live.prepare(localOnly, continueOnError)` → `live.commit`. Không đổi policy, công thức, bộ lọc ẩn, lô 50, dấu vân tay, xác minh sau ghi hoặc luồng khôi phục hiện có.
5. `AUTO_UPDATE_LIMIT = 2000`: **trên** 2.000 món lệch giá thì dừng, không PUT; số này tính trước khi tách món giữ giá tay. Bận, tải lỗi, vượt ngưỡng và không có món cần đổi đều có Lịch sử. Lượt đã nhận ngày không thử lại ngày đó. Nhận lịch dở dang có bản ghi gián đoạn khi khởi tạo lại; bản ghi có nhật ký giá được khử trùng bằng `scheduleId`.
6. Giá mong thấy lấy theo ID Kiot từ lần **ghi và xác minh thành công** gần nhất trong `updates`, kể cả bấm tay/khôi phục; chưa có thì P0. Không dùng lỗi, chưa xác minh hoặc no-op để thay mốc. Giá khác được lưu thành `skipped_manual_price` trong `manualPriceSkips` của lượt, không vào engine gửi, số lỗi hay `retry-selection`. Không tự gửi lại món còn `unknown`/`sending` từ lượt trước; Lịch sử ghi rõ chưa xác minh.
7. API `GET/POST /api/auto-update/settings` nằm sau bộ chặn đăng nhập, `sale.manage`, same-origin sẵn có. POST chỉ nhận đúng **hai trường** `enabled: boolean`, `time: HH:MM` hợp lệ; thiếu, thừa, sai kiểu/giờ trả 400. Máy không được phép trả 403 khi đổi cài đặt. Cài đặt bị chặn trong lượt tự động và khi core đang dừng.
8. Chưa có hook audit riêng cho Sale AI trong web hiện tại: dùng phương án dự phòng được spec cho phép, lưu ai đổi (ID/email từ `res.locals.user`), thời điểm, trước/sau trong kho lịch và hiển thị ở Lịch sử. Không thêm bảng DB hay thay hệ thống audit chung.
9. Giao diện theo `TASK-137-demo.html` và style hiện có: dòng trạng thái ở đầu Kết quả, switch, giờ/T2–T7, lần tới, Máy: Laptop; ô giờ + Lưu/Huỷ; xác nhận inline trước khi bật/đổi giờ. Máy không được phép khoá điều khiển và hiện chú thích. Trạng thái Đang chạy cập nhật qua polling, dùng tiến độ nền hiện có. Không dùng `confirm()`.
10. Lịch sử có nhãn AUTO/Tự động cập nhật, tóm tắt giữ giá tay, tab **Giữ giá sửa tay (N)** và ba mức giá: hiện tại, Sale AI ghi trước, dự kiến. Các lỗi ghi thực sự tiếp tục dùng cập nhật lại như trước. API frontend không chèn `dataset` vào body cài đặt nghiêm ngặt.

## File liên quan

Thư mục gốc dưới đây: `Webstie/server/src/`.

- `sale-ai/lib/auto-update.js` (mới): lịch, lưu cài đặt/ngày, sự kiện Lịch sử, lựa chọn và đối chiếu giá.
- `sale-ai/core.js`, `sale-ai/runtime.ts`: bộ kiểm tra định kỳ, API và nối khoá/luồng ghi.
- `sale-ai/lib/live.js`: đưa `trigger`, `scheduleId`, danh sách giữ giá tay/chưa xác minh vào nhật ký trước khi gửi.
- `sale-ai/lib/update-report.js`, `sale-ai/lib/view-data.js`: phân loại, đếm và chi tiết Lịch sử.
- `sale-ai/public/app.js`, `live-ui.js`, `index.html`, `style.css`: dòng lịch, xác nhận, polling và chi tiết giữ giá tay.
- `sale-ai/test/auto-update.test.js` (mới), `auto-update-ui.test.js` (mới): fixture đồng hồ/Kiot/Sapo và hành vi điều khiển giao diện.
- `sale-ai/test/background-ui.test.js`: thêm kiểm tra body POST cài đặt chỉ có hai trường.
- `sale-ai/test/runtime-fatal.test.js`, `tests/saleAiRuntime.test.ts`: cập nhật fake core với phương thức mới `checkAutoUpdate`; giữ nguyên assertion và timeout hiện có.
- `tests/saleAiProxy.test.ts`: thêm kiểm tra quyền đăng nhập/`sale.manage` cho GET/POST cài đặt và kiểm tra chặn cross-origin.
- `sale-ai/AUTO-UPDATE.md` (mới): cách Bảo tự bật đúng một máy, cửa sổ, ngưỡng, nhật ký và cách vận hành.
- `tasks/TASK-137-result.md`: báo cáo này. Không sửa spec/demo đã được duyệt.

## Test đã viết để Claude chạy

- Thứ 2 đúng giờ, tick đồng thời/lặp, khởi tạo lại cùng ngày; Chủ nhật; công tắc Tắt; bật lại hôm sau; sai máy dù kho lưu Bật; cửa sổ 5 phút và bỏ giờ lỡ; giờ Việt Nam trên các timestamp UTC.
- Đổi sang 14:30, đổi sau khi đã chạy; cài đặt giữ qua khởi tạo lại; đầu/cuối khoảng giờ hợp lệ, giờ sai, thiếu/thừa trường và sai kiểu.
- Chỉ ghi giá Kiot; Sapo giả luôn ném lỗi nếu bị gọi; thử cả engine từng món và batch. M0 lệch giá bị bỏ. Món chưa từng ghi khác P0 được giữ; món bằng P0 được ghi.
- Mốc ghi trước 32.200.000, giá hiện tại 30.000.000; bỏ qua `unknown` khi tìm giá đã xác minh; tab/giá chi tiết; không tính lỗi và không vào thử lại; ghi tay thành công cho phép ngày sau chạy lại.
- Bận vẫn lưu ngày, có Lịch sử, không thử lại sau khi hết bận/khởi tạo lại. Tải lỗi, 2.001 món, 0 món, lỗi một phần, `unknown` không tự gửi ngày sau; lỗi lưu ngày chặn cả GET tải lại.
- UI bật chỉ ghi sau Đồng ý, Huỷ không ghi; sửa giờ có xác nhận; điều khiển khoá trên máy không được phép/đang chạy. Quyền và same-origin được bổ sung trong test Express hiện có.

**Chưa chạy bất kỳ test nào.** Viết test trước phần triển khai nhưng không chạy red/green theo yêu cầu trực tiếp giao toàn bộ test cho Claude. Không tuyên bố các test trên đã đạt.

## Kiểm tra thực tế

- `hostname`: `DESKTOP-4G5GOSR`.
- `node --check <file>` trên **11 file JavaScript** đã tạo/sửa (core, auto-update, live, update-report, view-data, app, live-ui và bốn file test JS): **exit 0**. Chỉ kiểm tra cú pháp, không thực thi core hay test.
- `git diff --check`: **exit 0**; Git có cảnh báo chuẩn hoá LF → CRLF trên một số file, không có lỗi whitespace.
- Impeccable context được chạy cho `public/live-ui.js`, giữ giao diện hiện có và mockup đã duyệt. Mechanical detector trên bốn file UI: **exit 1**, báo các phần có sẵn ngoài phạm vi (eyebrow “SALE AI”/chữ 10px trong `index.html`, viền trái ở `style.css`). Không sửa các phần không liên quan; kết quả detector không chứng minh QA hình ảnh.
- Không có lệnh bị sandbox chặn; không yêu cầu quyền.
- Không chạy `npm run build`, `npm test`, test lõi, E2E, BossTele hoặc QA trình duyệt; Claude sẽ chạy theo đặc tả. Không dùng kết quả từ task cũ làm bằng chứng cho TASK-137.

## Giới hạn và bước tiếp theo

- Chưa xác minh build/TypeScript, kết quả test, ảnh desktop/mobile, focus và polling trên trình duyệt thật. `ready_for_review` chưa phải nghiệm thu.
- Không gọi Kiot/Sapo thật; không đọc/sửa `.env`, khóa/token; không khởi động, dừng hay restart server; không commit/push; không cài package; không sửa BossTele hoặc kho dữ liệu sản xuất.
- Claude chạy `npm run build`, `npm test` tại `Webstie`, test lõi Sale AI, E2E `saleAiUpdateAll.test.ts` 5 lần, BossTele `npm test`, và kiểm tra UI theo mockup. Không cần thay timeout hay nới assertion.
- Sau nghiệm thu, **Bảo tự** thêm `SALE_AI_AUTO_UPDATE=1` trên Laptop và khởi động lại web, rồi bật công tắc. Không thêm trên PC. Agent chưa bật lịch thật trong phiên này.

## Sua theo review

Máy: Laptop (DESKTOP-4G5GOSR)

- Ngày: 04/11/2026. Trạng thái: `ready_for_review` sau sửa; chưa được Claude review độc lập lại, không ghi `verified`.
- Đã đọc AGENTS, README, spec, review và result TASK-137. Kế hoạch đã thực hiện: tái hiện lỗi → tìm nguyên nhân → sửa tối thiểu và thêm test → kiểm tra và bàn giao. Áp dụng ponytail full và quy trình kiểm chứng phản hồi review.

### Sửa từng phát hiện

1. **Test ngưỡng 600 triệu:** lỗi thực tế ở assertion `retry.total`, không phải số đếm hàng ẩn. `AutoUpdate.history()` cache theo state và revision lịch nhưng chưa theo mảng `state.updates`. Khi test thay mảng trên cùng state, API chọn lại dùng Lịch sử cũ và không tìm thấy lượt lỗi. Cache nay kiểm tra cả tham chiếu updates. Giữ nguyên test `hidden-before-july.test.js`, chính sách giá và bộ lọc 600 triệu.
2. **Tiến độ báo `state is not defined`:** `renderProgress(op, autoRunning=false)` nhận trạng thái qua tham số thay vì đọc state ngoài hàm. Poll truyền `status.autoUpdate?.running`, giữ nhãn tự động khi lịch đang chạy. Test tiến độ lô cũ giữ nguyên.
3. **Test polling Sapo thiếu ngữ cảnh trang:** bổ sung `statusOffline:false`, `state:{}`, `context` và `renderAutoUpdate` vào VM harness. Đây là phụ thuộc mới của polling TASK-137. Giữ nguyên dữ liệu trạng thái, bước chờ queue và assertion `Đang chờ giới hạn Sapo… · 3/10`; không đổi timeout, bỏ test hoặc nới assertion.
4. **Dòng lịch chậm đổi sau Đồng ý:** cập nhật đối tượng cài đặt từ phản hồi POST rồi render ngay trước khi chờ tải lại bảng. Áp dụng cả bật/tắt và đổi giờ; chỉ nhận cài đặt sau POST thành công. Fixture UI nay trả phản hồi riêng, không tự sửa settings trước code ứng dụng. Thêm test giữ tải lại bảng ở trạng thái chờ, kiểm tra dòng Bật và `nextAt` đã đổi ngay; đã xác nhận đỏ trước sửa và xanh sau sửa.

### File sửa trong lượt này

- `Webstie/server/src/sale-ai/lib/auto-update.js`: sửa điều kiện cache Lịch sử.
- `Webstie/server/src/sale-ai/public/app.js`: truyền trạng thái lịch vào hàm tiến độ.
- `Webstie/server/src/sale-ai/public/live-ui.js`: render cài đặt từ phản hồi POST ngay.
- `Webstie/server/src/sale-ai/test/sapo-rate-limit.test.js`: bổ sung phụ thuộc VM, giữ nguyên assertion.
- `Webstie/server/src/sale-ai/test/auto-update-ui.test.js`: trả phản hồi riêng và thêm test chống trễ.
- `tasks/TASK-137-result.md`: nối mục này. Bảo toàn các thay đổi có sẵn.

### Bằng chứng kiểm tra mới

Tại `Webstie/server/src/sale-ai/test`:

- Trước sửa: `node --test --test-isolation=none hidden-before-july.test.js kiot-batch-runtime.test.js sapo-rate-limit.test.js auto-update*.test.js` → **41/44 đạt**, đúng ba lỗi review.
- Test UI mới đã đỏ vì dòng vẫn ghi Tắt khi tải lại bảng đang chờ. Lỗi cú pháp arrow function trong lúc viết harness đã được sửa trước khi xác nhận lượt đỏ do hành vi.
- Sau sửa: `node --test --test-isolation=none hidden-before-july.test.js kiot-batch-runtime.test.js sapo-rate-limit.test.js auto-update*.test.js background-ui.test.js` → **54/54 đạt**, exit 0, không bỏ qua. Bao gồm ba file lỗi và toàn bộ `auto-update*.test.js` theo yêu cầu.
- `node --test --test-isolation=none history-details.test.js history-model.test.js journal-storage.test.js` → **12/12 đạt**, exit 0; kiểm tra Lịch sử, chọn lại, lưu/mở nhật ký và khôi phục bằng fixture.
- Lượt mở rộng cùng ba file trên cộng `background-update.test.js`: bốn test đầu đạt; test nền 1.500 sản phẩm chưa trả kết quả trong thời gian chờ. Đã dừng riêng tiến trình test bằng Ctrl+C, exit 1; **không tính lượt này là đạt**, không sửa test ngoài phạm vi, không dừng/restart máy chủ.

Kiểm tra khác:

- Tại `Webstie/server`: `node ../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` → **đạt**, exit 0. Lượt đầu dùng `./node_modules/...` lỗi `MODULE_NOT_FOUND`; đã sửa sang dependency được hoist ở thư mục cha, không cài package.
- `node --check` trên năm file JS sửa trong lượt này → **đạt**, exit 0.
- `git diff --check` → **đạt**, exit 0; có cảnh báo LF → CRLF, không lỗi whitespace.
- Impeccable context cho `public/live-ui.js` cho phép sửa hẹp theo giao diện hiện có. Detector trên `public/app.js` và `public/live-ui.js` trả `[]`, exit 0; không coi đây là QA trình duyệt.
- Lệnh `Get-CimInstance Win32_Process` để xem riêng tiến trình test bị sandbox từ chối: **Access denied**, HRESULT `0x80041003`. Không xin quyền; tiếp tục bằng session của chính tiến trình test.

### Giới hạn và bàn giao

- Không chạy toàn bộ `npm test`: shared có test đọc/ghi file `.env`, không phù hợp lệnh cấm truy cập `.env` trong phiên này. Không chạy build đầy đủ vì Vite có cơ chế nạp file môi trường; đã kiểm tra TypeScript server bằng `--noEmit`.
- Chưa chạy lại E2E, BossTele hay QA trình duyệt thật; kết quả review trước không được tính là bằng chứng mới cho bản sửa. Lượt test nền mở rộng chưa hoàn tất như ghi trên.
- Không đọc/sửa `.env`; không gọi Kiot/Sapo thật; chỉ dùng client fixture và socket loopback của test có sẵn. Không bật lịch thật, sửa kho sản xuất, dừng/restart server, cài dependency hoặc commit.
- Bước tiếp theo: Claude review độc lập lại bản sửa và xác minh các phần còn thiếu trong môi trường được phép.

