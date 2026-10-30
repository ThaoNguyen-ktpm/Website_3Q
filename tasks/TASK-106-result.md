# TASK-106 — Nhận mã Kiot có đuôi

- Dự án: web + BossTele.
- Người thực hiện: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai nhận mã, phân giải mã gốc và kiểm tra cục bộ ngày 30/10/2026.
- Bước tiếp theo: Claude review độc lập và chạy lại các kiểm tra bị sandbox chặn; kiểm tra Telegram thật sau khi khởi động lại bot.

## Thay đổi

1. Thêm helper `extractSkus`, `matchingSkus`, `skuChoice` cho mỗi gói:
   - `Webstie/server/src/services/assistant/sku.ts`.
   - `Webstie/BossTele/lib/sku.js` (CommonJS).
   - Nhận `SP` + ít nhất 4 số + một đuôi chữ/số tùy chọn; dùng lookbehind/lookahead `[A-Za-z0-9]`, không dùng `\b`; trả mã chữ hoa.
   - Ưu tiên khớp đầy đủ không phân biệt hoa thường. Chỉ mã không đuôi mới được tìm theo phần trước `_`. Một món thì dùng; nhiều món thì hỏi chọn tối đa 5 mã đầy đủ, không tính giá hay tự chọn.
2. Web:
   - `pricing.ts`: chỉ lấy mã từ lượt `user`; dùng mã đầy đủ đã tìm được cho tra vốn, tính giá và gợi ý tiếp theo; chuyển thông báo chọn mã khi trùng.
   - `router.ts`: nhận đầy đủ mã có đuôi.
   - `tools.ts`: áp dụng phân giải cho `tim_san_pham` và `tinh_gia`; lấy đủ kết quả trước khi chọn mã để không bỏ sót mã đúng hoặc trường hợp trùng do giới hạn trang. Giữ kiểm tra quyền và bộ tính giá hiện có.
   - `graph.ts`: thêm chuyển tiếp thông báo chọn mã từ tool trong nhánh tra sản phẩm trực tiếp. Đây là phần bổ sung cần thiết ngoài ba file điểm vào của spec để web và `quick` của Telegram không biến trường hợp trùng thành “không tìm thấy”.
3. BossTele:
   - `telegram-bot.js`: dùng helper tại các điểm nhận mã trong câu hỏi sale, thị trường, thẻ được nhắc tới và giá chốt. Tra theo mã gốc dùng được mã đầy đủ duy nhất; nhiều mã thì hỏi chọn. Lịch sử giá chốt chỉ đọc lượt người dùng.
   - `parseMoney` bỏ cả mã có đuôi trước khi tìm tiền; bỏ mã dài trước để câu có cả mã gốc và mã đuôi số cũng không để sót số ngày.
   - `sale-price.js`: CLI nhận mã có đuôi; phân giải mã trên danh mục web và kho Sale AI trước khi gọi `calculate`. Trường hợp nhiều mã trả `status: ambiguous`, `candidates` và lý do hỏi chọn, không có giá tính. Giữ đọc file thuần và công thức Sale AI thật.

## Test thêm

- `server/src/tests/assistantSku.test.ts`: nhận đuôi chữ/số, chữ hoa/thường, ranh giới, mã cũ, ưu tiên đúng mã, không thay đuôi và giới hạn 5 lựa chọn.
- `server/src/tests/assistantPricing.test.ts`: không lấy mã ví dụ của trợ lý; nhận mã có đuôi và mã gốc duy nhất; dùng mã đầy đủ trong gợi ý; không tính giá khi mã gốc trùng.
- `server/src/tests/assistantTools.test.ts`: thẻ có vốn, tính giá từ mã đầy đủ/mã gốc, trùng mã ở cả hai tool, ưu tiên mã đúng sau nhiều kết quả có đuôi, không nhận nhầm đuôi khác.
- `server/src/tests/assistantRouter.test.ts`: định tuyến mã có đuôi và trả câu hỏi chọn mã mà không gọi model.
- `BossTele/test/sku.test.js`: parser, phân giải, thẻ giá chốt với mã đầy đủ/mã gốc/mã cũ; sale dùng mã đầy đủ; trùng mã hỏi chọn; lịch sử chỉ có mã ví dụ của bot không được dùng làm mã hỏi giá chốt.
- `BossTele/test/close-price.test.js`: `parseMoney("SP025211_29102026 khách trả 45tr") = 45000000`; chỉ có mã đuôi số hoặc đồng thời mã gốc và mã đuôi số thì không có tiền.
- `BossTele/test/sale-price.test.js`: thêm một test dùng kho tạm và thư viện Sale AI thật để kiểm tra mã gốc, hoa/thường, ưu tiên mã đúng, trùng mã và đuôi không tồn tại.

Không sửa kỳ vọng test cũ. File `sale-price.test.js` đã có thay đổi chưa commit trước phiên; giữ nguyên các thay đổi đó và chỉ thêm test TASK-106.

## Lệnh và kết quả thực tế

- Trước khi sửa `parseMoney`, chạy trực tiếp `node test/close-price.test.js`: test mới thất bại đúng lỗi `29102026 !== null`; 7 test cũ qua. Sau sửa, cả 8 test qua.
- Tại `Webstie/BossTele`, chạy:

  ```powershell
  node --test --test-isolation=none test/sku.test.js test/close-price.test.js test/sale-price.test.js test/telegram-bot.test.js test/market-lookup.test.js
  ```

  **43/43 qua**, không bỏ qua test. Lần chạy cuối sau sửa trường hợp nhiều mã trong `parseMoney` cũng đạt 43/43.
- `node --test --test-isolation=none test/*.test.js`: **137 test, 108 qua, 29 thất bại**, không bỏ qua. Cả 29 thất bại thuộc `test/add.test.js`, tại các ca CLI: 7 ca thành công với các dạng số, 3 ca số lượng đối số sai, 16 ca giá trị không hợp lệ, 1 ca báo đối số sai đầu tiên và 2 ca tràn số. Tất cả đều có lỗi `spawnSync ... node.exe EPERM`; không sửa hoặc nới test để che lỗi môi trường.
- `node --check` cho `telegram-bot.js`, `sale-price.js`, `lib/sku.js`: qua.
- Self-check bằng Node nhập trực tiếp `server/src/services/assistant/sku.ts`: 6 assertion qua (đuôi/ranh giới, khớp đầy đủ, mã gốc duy nhất, mã gốc trùng, đuôi khác, tối đa 5 lựa chọn). Đây chỉ là kiểm tra helper, không thay thế Vitest.
- Tại `Webstie`, `npm.cmd run build --workspace server`: **qua**, TypeScript server biên dịch thành công.
- `npm.cmd run build` tại `Webstie`: server qua; TypeScript client qua; Vite client bị **`spawn EPERM`** khi esbuild tải `vite.config.ts`. Build toàn website chưa hoàn tất.
- `npm.cmd test` tại `Webstie`: **bị chặn `spawn EPERM`**, Vitest không khởi tạo được workers (59 lỗi khởi tạo, không test nào chạy). Việc đếm này gồm các test Sale AI đang có trong working tree; không chỉnh sửa vùng đó.
- Thử `npm.cmd test -- --pool=threads` tại `Webstie/server`: vẫn bị **`spawn EPERM`** trong Vite `optimizeSafeRealPathSync`, 59 suite không chạy được. Không tuyên bố Vitest web đã qua.
- Lệnh Vitest nhắm riêng `assistantPricing.test.ts` và `assistantTools.test.ts` cũng bị chặn `spawn EPERM` trước khi chạy test.
- `npm.cmd test` và `node --test test/close-price.test.js` tại BossTele bị **`spawn EPERM`** khi test runner tạo tiến trình. Các kết quả qua ở trên dùng chế độ cùng tiến trình, không đổi cấu hình repo và không xin nâng quyền.
- `git diff --check`: qua.

## Giới hạn và bảo toàn phạm vi

- Chưa chạy được các test Vitest web; server build không kiểm tra kiểu của file test vì tsconfig loại `src/tests`.
- Chưa thử trên Telegram thật hoặc xác minh một lượt hỏi đáp web với danh mục thật; test dùng fixture cục bộ, thư viện tính giá Sale AI thật, không gọi API/model thật.
- Không đổi công thức giá, quyền xem vốn, hoặc nội dung trả lời khác ngoài câu hỏi chọn mã mới.
- Không sửa `Webstie/server/src/sale-ai/`, `Webstie/scripts/dev.mjs`, frontend hoặc các thay đổi có sẵn ngoài phạm vi. Không thêm dependency, không commit, không ghi dữ liệu lên dịch vụ thật, không in khóa/token.
- Chưa được Claude kiểm tra độc lập; chưa ghi `verified`.
