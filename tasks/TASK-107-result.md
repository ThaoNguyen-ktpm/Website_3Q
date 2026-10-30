# TASK-107 — Trợ lý trả lời giá vốn

- Dự án: web + BossTele.
- Người thực hiện: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai và kiểm tra cục bộ ngày 30/10/2026.
- Bước tiếp theo: Claude review độc lập, chạy `npm run build`, `npm test` tại `Webstie` và `npm test` tại `Webstie/BossTele` trong môi trường không chặn spawn.

## Thay đổi

1. `Webstie/server/src/services/assistant/pricing.ts`:
   - Tách ý hỏi vốn khỏi `pricingIntent`, nhận các dạng “giá vốn”, “xem vốn”, “vốn bao nhiêu”, “vốn của”, “nhập giá bao nhiêu”, có/không dấu và không phân biệt hoa thường.
   - Dùng lại `tim_san_pham`, phân giải SKU đầy đủ/mã gốc và lịch sử chỉ lấy mã từ lượt người dùng của TASK-106.
   - Có quyền và có vốn: trả một dòng vốn, giá bán, lời và phần trăm lời trên vốn, dùng `vnd`/`pct` hiện có. Không có giá bán (`null` hoặc `0`) thì chỉ ghi vốn.
   - Nhiều mức vốn chi nhánh: chọn vốn cao nhất để tính lời, ghi các mức vốn khác nhau, bỏ giá trị trùng.
   - Không có quyền: báo đúng “Bạn không có quyền xem giá vốn.”, giữ giá bán và thẻ. Thiếu vốn: báo chưa có giá vốn trên KiotViet và giá bán hiện tại.
   - Giữ luồng giá chốt khi câu có ý giá chốt/thương lượng hoặc tỷ lệ lời; lệnh tính giá vốn dạng gán tham số được nhường cho handler có sẵn. Không có SKU thì hỏi mã để xem vốn.
2. `Webstie/server/src/tests/assistantPricing.test.ts`: thêm test các cách hỏi, quyền và không lộ vốn, thiếu vốn, khác vốn chi nhánh, thiếu giá bán, lỗ/phần trăm lẻ, lệnh tính giá và hồi quy giá chốt.
   - Cập nhật **một kỳ vọng có chủ đích** của test TASK-106: câu `xem giá vốn` với mã đầy đủ/mã gốc nay phải trả dòng vốn thay vì gợi ý nút giá chốt. Đây là thay đổi hành vi TASK-107 yêu cầu; không nới lỏng test để che lỗi. Giữ và bổ sung assertion tra đúng mã, thẻ đúng món.
3. `Webstie/BossTele/test/telegram-bot.test.js`: thêm hai test xác nhận câu hỏi vốn đi qua `quick`, gửi nguyên câu trả lời web kèm thẻ, không gọi Claude/Sale AI; lệnh `tính giá vốn=… chi_phí=…` vẫn đi qua command handler.

## Kiểm tra luồng

- `telegram-bot.js`: `parseCommand` nhận lệnh tính giá có tham số trước luồng hội thoại; câu `xem giá vốn SP025211_KG` không khớp command/giá chốt/sale nên đến `quick`. `webQuick` gửi messages tới `/internal/assistant`; `sendAnswer` gửi reply rồi thẻ sản phẩm.
- `graph.ts`: `lookupAnswer` gọi `pricingAnswer` trước tra sản phẩm thông thường. Không cần sửa `telegram-bot.js` hay `graph.ts` trong task này.
- Các thay đổi TASK-106 chưa commit trong pricing và test được giữ lại.

## Bằng chứng kiểm tra

- Tại `Webstie/server`: `npx.cmd tsc -p tsconfig.json --noEmit` — **qua**, exit code 0. Không xuất build hoặc tác động máy chủ đang chạy. Cấu hình TypeScript server loại thư mục test nên lệnh này không xác nhận kiểu của test.
- Tại `Webstie/BossTele`:

  ```powershell
  node --test --test-isolation=none test/telegram-bot.test.js test/sku.test.js test/close-price.test.js test/chat.test.js
  ```

  **47/47 test qua**, không bỏ qua test, gồm hai test TASK-107. Chạy cùng tiến trình để không cần spawn; không sửa cấu hình hoặc bỏ assertion.
- Tại `Webstie`: self-check tạm qua stdin Node, dùng TypeScript đã cài để nạp mã nguồn thật `pricing.ts`, `brands.ts`, `sku.ts`; giả lập riêng tool tra sản phẩm và không dùng catalog thật: **24 assertion qua**. Bao phủ mã đầy đủ/mã gốc, đủ các cách hỏi, quyền, thiếu vốn, vốn khác nhau, giá bán `null`/`0`, lỗ, giá chốt và câu trộn, không lấy mã từ bot, nhường lệnh tính giá. Không thay thế Vitest hoặc kiểm tra HTTP thực tế.
  - Lần self-check đầu thất bại do PowerShell truyền tiếng Việt qua stdin với encoding không phù hợp; đặt `$OutputEncoding` và console thành UTF-8 rồi chạy lại đạt kết quả trên. Không sửa logic ứng dụng theo lỗi harness này.
- `git diff --check` — **qua**; có cảnh báo chuyển LF/CRLF, không có lỗi whitespace.

## Lệnh bị sandbox chặn

- Tại `Webstie/server`: `npx.cmd vitest run src/tests/assistantPricing.test.ts` — **spawn EPERM** khi esbuild tải cấu hình, chưa chạy test.
- Thử `npx.cmd vitest run src/tests/assistantPricing.test.ts --configLoader runner --pool=threads` — **spawn EPERM** tại Vite `optimizeSafeRealPathSync`, vẫn chưa chạy test.
- Tại `Webstie/BossTele`: `npm.cmd test` — **spawn EPERM** khi Node test runner khởi tạo tiến trình cho 17 file test; 0 file chạy thành công. Đây là lỗi khởi tạo, không phải kết quả assertion của các suite.
- Không xin quyền hoặc chạy nâng quyền. Build/test đầy đủ tại `Webstie` để Claude chạy theo phân công trong spec; không tuyên bố các kiểm tra đó đã qua.

## Giới hạn và bảo toàn phạm vi

- Chưa chạy được Vitest assistant, chưa kiểm tra HTTP `/internal/assistant` hoặc Telegram thật với dữ liệu KiotViet thật; chưa được Claude review độc lập.
- Fixture chỉ dùng trong kiểm thử, không thay nguồn dữ liệu ứng dụng. Không gọi API/model thật, không gửi Telegram thật, không in hoặc ghi khóa/token.
- Chỉ sửa ba file code/test nêu trên và tạo báo cáo này. Không sửa `Webstie/server/src/sale-ai/`, `Webstie/scripts/dev.mjs`, frontend, dependency hoặc cấu hình test.
- Giữ nguyên các thay đổi chưa commit của task khác. Không dừng/khởi động lại máy chủ, không commit.
