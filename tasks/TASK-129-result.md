Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-129 — Trợ lý mặc định chỉ hiện sản phẩm còn hàng

- Dự án: web + BossTele.
- Người phụ trách: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: 03/11/2026, triển khai, bổ sung kiểm thử và chạy các lệnh kiểm tra trong sandbox.
- Bước tiếp theo: Claude chạy lại build/test chuẩn ngoài sandbox và review độc lập theo `TASK-129-spec.md`. Chưa được Claude kiểm tra, chưa ghi `verified`.

## Thay đổi

1. `Webstie/server/src/services/assistant/router.ts`: mọi truy vấn danh sách được router nhận diện mặc định `inStock: true`, gồm tên/thương hiệu, Hot trend, giá và sắp xếp. Câu chứa “hết hàng” (cả không dấu) giữ `false`; SKU luôn giữ `false`.
2. `Webstie/server/src/services/assistant/graph.ts`: dùng chung đối tượng tham số truy vấn; khi trang đầu còn hàng rỗng thì gọi lại chỉ đổi `in_stock: false`. Có tổng N thì báo “Có N sản phẩm … nhưng đều đã hết hàng.”, không trả products hoặc nguồn sản phẩm. Cả hai lần đều rỗng thì giữ câu không tìm thấy. Không gọi lại khi thiếu quyền, hết trang hoặc tra SKU. Tiêu đề danh sách có hàng ghi “còn hàng”, N lấy từ tổng sau lọc; phần số món mới nhất giữ nguyên. SKU tồn 0/âm có câu “<SKU> đã hết hàng.” và giữ thẻ.
3. `Webstie/BossTele/telegram-bot.js`: thêm một dòng vào SYSTEM hướng dẫn mặc định `node catalog.js ... --in-stock`, đếm lại không có cờ nếu hết toàn bộ, không gửi SKU/thẻ trong câu báo hết; ngoại lệ hỏi hàng hết hoặc SKU không thêm cờ.
4. `Webstie/server/src/tests/assistantRouter.test.ts`: thêm các trường hợp mặc định/ngoại lệ, đếm lại cùng bộ lọc, hết trang, thiếu quyền, SKU tồn 0/âm. Đổi kỳ vọng tiêu đề Hot trend theo đặc tả.
5. `Webstie/server/src/tests/assistantBrands.test.ts`: đổi kỳ vọng tiêu đề sau sửa lỗi chính tả thành “… Chanel còn hàng:”. Đây là thay đổi hành vi được đặc tả cho phép, không nới test.
6. `Webstie/server/src/tests/assistantStock.test.ts` (mới): đi qua `quickAnswer` → router → công cụ thật, chỉ mock catalog ở biên I/O và chặn network. Bao phủ danh sách trộn hàng còn/hết/null, từ khóa và thương hiệu, tổng trước phân trang, cọc, bộ lọc Hot/giá khi đếm lại, không khớp, hỏi hàng hết, SKU hết và tính giá chốt theo SKU hết.
7. `tasks/TASK-129-plan.md`: kế hoạch thực hiện.

Không thay bộ lọc `(item.onHand ?? 0) > 0` trong tools.ts: tồn null vẫn bị loại, tồn dương có cọc vẫn đi qua bộ lọc; cách hiển thị cọc giữ nguyên. Không sửa trang Tìm kiếm, Sale AI, công thức giá hay nhãn thẻ. Các thay đổi shared/import đã có sẵn trong tools.ts và telegram-bot.js được giữ nguyên; phần của TASK-129 trong telegram-bot.js chỉ là một dòng SYSTEM.

## Kiểm tra và bằng chứng thực tế

Môi trường: Node `v24.21.0`, PowerShell, dùng `npm.cmd`/`npx.cmd`. Không tạo log của task này trong `tasks/`; bằng chứng ghi trực tiếp tại đây.

### Build chuẩn

Tại `Webstie/`: `npm.cmd run build` — **exit 1**.

```text
> website-server@0.1.0 build
> tsc -p tsconfig.json && node scripts/copy-sale-ai.mjs
> baoq-internal@0.1.0 build
> tsc --noEmit && vite build
failed to load config from D:\Website_3Q\Webstie\frontend\vite.config.ts
Error: spawn EPERM
    at ensureServiceIsRunning (...\esbuild\lib\main.js:1978:29)
```

Build server (gồm bước chép Sale AI) và typecheck frontend đã chạy qua; frontend bundle Vite chưa chạy được. Không coi toàn bộ build đạt.

### Test chuẩn

- Tại `Webstie/`: `npm.cmd test` — **exit 1**, dừng ở shared trước frontend/server/Sale AI. Cả 5 file `catalog-fetcher.test.js`, `connection-config.test.js`, `product-search-detail.test.js`, `product-search.test.js`, `target-price.test.js` không khởi chạy được tiến trình test: `Error: spawn EPERM`, `node:internal/test_runner/runner:529:19`. Tổng wrapper: 0 pass, 5 fail; không phải 5 assertion nghiệp vụ thất bại.
- Tại `Webstie/BossTele/`: `npm.cmd test` — **exit 1**, cả 13 wrapper file bị `spawn EPERM` trước khi chạy nội dung test: add, buy-price, catalog, chat, close-price, listing-draft, market-lookup, sale-price, sku, stock-gap, telegram-access, telegram-bot, telegram-product-guard.
- Trước sửa code đã thử `npx.cmd vitest run src/tests/assistantRouter.test.ts src/tests/assistantBrands.test.ts` tại server: **exit 1**, esbuild nạp config bị `spawn EPERM`. Vì vậy chưa chứng minh được vòng đỏ/xanh của Vitest; không tuyên bố test mới đã chạy đạt.
- Sau sửa code chạy tại server:

```powershell
npx.cmd vitest run --configLoader native --pool threads --maxWorkers 1 src/tests/assistantRouter.test.ts src/tests/assistantStock.test.ts src/tests/assistantTools.test.ts src/tests/assistantBrands.test.ts src/tests/assistantPricing.test.ts src/tests/assistantGraph.test.ts src/tests/internalApi.test.ts
```

**Exit 1**: 7 suite không thu thập được test, `Tests no tests`; lỗi `spawn EPERM` tại `optimizeSafeRealPathSync` → `windowsSafeRealPathSync` trong Vite. Cách nạp native cũng không giải quyết được hạn chế sandbox. Không sửa cấu hình hay test runner của dự án.

### Kiểm tra bổ sung có chạy được

1. `node --check telegram-bot.js` tại BossTele — **exit 0**.
2. `node --test --test-isolation=none test/*.test.js` tại BossTele — **exit 1**, 112 test, **83 pass / 29 fail**, 0 skip. Toàn bộ 29 fail nằm trong `test/add.test.js`, đều do `spawnSync C:\Program Files\nodejs\node.exe EPERM`: 7 trường hợp CLI success, 3 trường hợp thiếu/thừa đối số, 16 trường hợp đầu vào không hợp lệ, 1 trường hợp ưu tiên lỗi đầu tiên, 2 trường hợp overflow. Các test bot, giá chốt, thị trường và sale chạy trong tiến trình đạt trong lần này; không thay thế kết quả `npm test` chuẩn.
3. Tại server, chạy kiểm tra assert trực tiếp bằng **`node --input-type=module` qua stdin**, nhập các module thực tế vừa build trong `dist/services/assistant/`. Dùng `node:module.registerHooks` thay catalog bằng fixture trong bộ nhớ; stub env/model/nhân viên/audit/tài liệu/embedding để không truy cập nguồn thật, fetch luôn ném lỗi. Router, graph, tools, SKU và bộ tính giá dùng mã thực tế. **Exit 0**, đầu ra:

```text
PASS: offline compiled quickAnswer/router/tools; stock totals, paging, filters, sold-out count, no match, explicit sold-out, SKU, closing price, denied; no network/model.
```

Các assert đã qua:

- 12 món còn, cộng món tồn 0/âm/null và món sai từ khóa: tiêu đề tổng 12, hiện 10 món mới nhất; món tồn dương có `inventories.reserved=1` vẫn có thẻ và reserved=1.
- “mẫu khác” trên danh sách đó: chỉ SP000011/SP000012, dòng “Thêm sản phẩm Louis Vuitton (11–12 / 12):”.
- “túi LV Carryall hot dưới 50 triệu”: 2 món hết; món còn sai tên, vượt giá hoặc không Hot đều không bị tính. Gọi catalog 2 lần; câu báo hết, không products, sources rỗng.
- Không khớp: câu “Không tìm thấy sản phẩm Louis Vuitton, tui trên KiotViet.”, 2 lượt tra.
- Hỏi “túi LV nào hết hàng”: vẫn trả cả món tồn 0 và 1 theo hành vi không lọc cũ, 1 lượt tra.
- SKU SP014899 tồn 0: có thẻ và câu hết hàng, 1 lượt tra. “SP014899 giá chốt lời 15%” với vốn 20 triệu: vẫn tính mức 23 triệu và giữ thẻ tồn 0.
- Hết trang: câu kết thúc phân trang, chỉ 1 lượt tra; thiếu quyền: câu từ chối, không đọc catalog.
- Mặc định còn hàng cho tên/thương hiệu, Hot, khoảng giá và sắp xếp.

Hai lần đầu của kiểm tra stdin chưa đạt do thiếu `audit.actionLabels` trong stub rồi kỳ vọng nhầm kích thước trang là 5. Đã đối chiếu tools.ts: danh sách broad dùng 10 món và reserved được tổng từ `kiot.inventories`, nên sửa fixture/kỳ vọng theo hành vi hiện có; không sửa code ứng dụng để chiều kiểm tra. Lần cuối đạt như đầu ra trên. Đây là bằng chứng offline với fixture, không phải Vitest hay xác minh tích hợp thật.

4. `git diff --check -- Webstie/server/src/services/assistant/router.ts Webstie/server/src/services/assistant/graph.ts Webstie/server/src/tests/assistantRouter.test.ts Webstie/server/src/tests/assistantBrands.test.ts Webstie/BossTele/telegram-bot.js` — **exit 0**, chỉ cảnh báo chuyển LF/CRLF của Git.
5. Kiểm tra qua stdin bằng TypeScript `transpileModule` cho 3 file test thêm/sửa — **exit 0**, không lỗi cú pháp; kiểm tra file mới không chứa ký tự thay thế U+FFFD. Đây là kiểm tra cú pháp, không phải typecheck test hoặc chạy Vitest. Thư mục tasks chỉ có các file TASK-129 spec/plan/result, không có log TASK-129.

## Giới hạn và giả định cần bàn giao

- Giữ giả định của đặc tả: Bảo hỏi đích danh SKU thì vẫn muốn thấy thẻ dù hết hàng; đã triển khai, để Bảo xác nhận trong review.
- “Hết hàng” là ngoại lệ bỏ bộ lọc, không phải bổ sung chế độ chỉ hiện món hết. Đây là yêu cầu giữ hành vi hiện tại.
- Chưa chạy được Vitest, build frontend hoàn chỉnh hay các bộ test chuẩn do sandbox; không xin quyền theo yêu cầu. Claude cần chạy lại các lệnh chuẩn và 7 suite tập trung ở trên.
- Chưa kiểm tra giao diện trình duyệt, Telegram thật hoặc hành vi Claude thật sau cập nhật SYSTEM. Không khởi động bot, không gọi/ghi KiotViet/Sapo hay dịch vụ thật; không commit.
