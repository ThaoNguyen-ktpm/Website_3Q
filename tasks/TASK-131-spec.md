# TASK-131 — Gom hàm dùng chung (bỏ dấu, mã SP, ghi tiền) vào `Webstie/shared/`

- Dự án: web và BossTele
- Người giao: Claude · Người làm: Codex
- Trạng thái: `ready_for_review`
- Hành động gần nhất: Codex triển khai ngày 03/11/2026; bằng chứng và giới hạn sandbox tại `tasks/TASK-131-result.md`.
- Bước tiếp theo: Claude kiểm tra độc lập, chạy lại build/test chuẩn và kiểm thật các câu trả lời.

## Mục tiêu
Ba nhóm hàm nhỏ đang bị chép ở nhiều file trong server và BossTele. Gom mỗi nhóm về một file trong `Webstie/shared/` để sửa một lần là đủ. **Hành vi không đổi:** web, trợ lý web, Sale AI và bot Telegram trả lời y như trước, kể cả từng ký tự trong câu trả lời.

## Phạm vi
1. **Bỏ dấu tiếng Việt (`fold`).** Tạo `Webstie/shared/text.js`, export `fold(text)`: `String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase()`. Thay 13 bản chép (danh sách ở mục Vùng code).
   - `server/src/services/assistant/brands.ts` còn bỏ ký tự không phải chữ/số. Giữ đúng hành vi bằng `fold(text).replace(/[^a-z0-9]+/g, ' ').trim()`, và giữ tên export `fold` của brands.ts vì router.ts và pricing.ts đang import nó.
   - `light` trong `server/src/services/assistant/pricing.ts` giống hệt `fold` thường: thay bằng `fold` của shared, giữ comment hiện có.
2. **Mã SP (`extractSkus`, `matchingSkus`, `skuChoice`).** Chuyển `Webstie/BossTele/lib/sku.js` thành `Webstie/shared/sku.js`. Xoá bản chép `server/src/services/assistant/sku.ts` và `BossTele/lib/sku.js`. Mọi nơi gọi dùng bản shared.
3. **Ghi tiền.** Tạo `Webstie/shared/money.js` export:
   - `vnd(value)`: `` `${Math.round(value).toLocaleString('vi-VN')}đ` `` (vd 46.000.000đ)
   - `tr(value)`: `` `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr` `` (vd 47,6tr)
   
   Thay các bản chép đúng hai kiểu này. Bản nào ghi khác kiểu thì không đụng (xem Ngoài phạm vi).

## Ngoài phạm vi
- Sale AI (`server/src/sale-ai/**`), gồm `lib/pricing.js` `money` và `lib/kiot.js`. Không gộp client Kiot của Sale AI với `shared/product-search.js`: Sale AI ghi giá thật lên Kiot.
- `frontend/` (bundle ESM riêng; `ui.tsx` `money` ghi " ₫", định dạng khác).
- `BossTele/chat.js` `money` (ghi "VND"), `parseMoney` của BossTele và `amount` trong `router.ts`: cách đọc tiền khác nhau, không gộp.
- Không tách `telegram-bot.js` trong task này. Quy tắc tách dần (BossTele/AGENTS.md) chỉ áp dụng khi sửa một nhánh, còn task này chỉ đổi dòng import.
- Không xoá `Webstie/.task-110-client-backup/` (chờ Bảo quyết, xem cuối file).
- `BossTele/vendor/`, `server/src/v2/mockup/`.

## Yêu cầu
- File shared viết CommonJS (`'use strict'`, `module.exports`) giống `shared/product-search.js`; Node >= 22, không thêm dependency.
- Server (ESM/TypeScript) lấy hàm shared qua `server/src/config/shared.js` theo cách hiện có (`createRequire` + JSDoc `@type`). Khai báo kiểu đầy đủ, không dùng `any`; `matchingSkus` giữ kiểu generic như `sku.ts` hiện tại (`<T extends { sku: string }>(items: T[], sku: string) => T[]`).
- BossTele `require('../shared/…')` (đường dẫn tương đối như `telegram-bot.js` đang dùng cho `product-search`). Sửa trong `BossTele/lib/*` thì là `../../shared/…`.
- Giữ nguyên comment có sẵn ở chỗ thay; chỉ xoá dòng định nghĩa bị trùng.
- Test có sẵn không sửa logic hay kỳ vọng. Được đổi **đường dẫn import** của test trỏ tới file đã xoá (`BossTele/test/sku.test.js`, `server/src/tests/assistantSku.test.ts`), hoặc chuyển test đó sang `shared/test/sku.test.js`; ghi rõ trong result.
- Thêm test nhỏ cho shared: `shared/test/text.test.js` (có dấu, "đ/Đ", null, chữ hoa), `shared/test/money.test.js` (46000000 → "46.000.000đ", 47600000 → "47,6tr"), và `shared/test/sku.test.js` nếu chuyển test SKU sang đó.

## Tiêu chí nghiệm thu
1. Lệnh sau chỉ còn ra `shared/text.js`:
   `grep -rnF "normalize('NFD')" Webstie/shared Webstie/server/src Webstie/BossTele/*.js Webstie/BossTele/lib --include=*.js --include=*.ts | grep -v node_modules | grep -v /test` (Sale AI không có bản chép nào, nên nếu nó xuất hiện là lỗi).
2. Không còn `server/src/services/assistant/sku.ts` và `BossTele/lib/sku.js`. `extractSkus` chỉ định nghĩa ở `shared/sku.js`.
3. `const vnd = value =>` và `const tr = value =>` không còn trong `BossTele/telegram-bot.js`, `BossTele/lib/buy-price.js`, `BossTele/lib/market-lookup.js` và `server/src/services/assistant/pricing.ts`.
4. Tất cả test có sẵn đạt mà không đổi kỳ vọng:
   - `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` (gồm shared, frontend, server, Sale AI).
   - `npm test` tại `D:\Website_3Q\Webstie\BossTele`.
5. Kiểm thật sau khi build, ghi bằng chứng vào result: bot Telegram (hoặc `node chat.js`) trả lời "giá sale SP…", "túi Chanel" và trợ lý web trả lời "mẫu hot chanel" giống trước khi đổi. Không chạy được bot thật thì ghi `blocked` cho phần đó, không thay bằng mô phỏng.

## Lệnh kiểm tra
```
cd D:\Website_3Q\Webstie && npm run build && npm test
cd D:\Website_3Q\Webstie\BossTele && npm test
cd D:\Website_3Q\Webstie\shared && npm test
```

## Vùng code
Lấy từ grep/CodeGraph ngày 03/11/2026; chạy lại `codegraph_explore` với tên symbol trước khi sửa vì số dòng có thể lệch.

**Điểm vào — `fold` (13 bản chép):**
- `Webstie/server/src/services/assistant/brands.ts:12` (`export const fold`, bản có bỏ dấu câu)
- `Webstie/server/src/services/assistant/graph.ts:18`
- `Webstie/server/src/services/assistant/pricing.ts:14` (`light`)
- `Webstie/server/src/services/assistant/tools.ts:54`
- `Webstie/server/src/services/catalogStore.ts:30`
- `Webstie/BossTele/catalog.js:10`
- `Webstie/BossTele/telegram-bot.js:120`
- `Webstie/BossTele/lib/boss-memory.js:9`
- `Webstie/BossTele/lib/buy-price.js:12`
- `Webstie/BossTele/lib/listing-draft.js:11`
- `Webstie/BossTele/lib/market-lookup.js:12`
- `Webstie/BossTele/lib/price-feedback.js:8`
- `Webstie/BossTele/lib/telegram-product-guard.js:9`

**Điểm vào — mã SP:** `Webstie/server/src/services/assistant/sku.ts` (cả file), `Webstie/BossTele/lib/sku.js` (cả file).
- Nơi gọi server: `assistant/pricing.ts`, `assistant/router.ts`, `assistant/tools.ts`.
- Nơi gọi BossTele: `telegram-bot.js`, `sale-price.js`.

**Điểm vào — ghi tiền:**
- `Webstie/BossTele/telegram-bot.js:119` (`vnd`), `:144` (`tr`)
- `Webstie/BossTele/lib/buy-price.js:13` (`tr`)
- `Webstie/BossTele/lib/market-lookup.js:38` (`vnd` bên trong `marketPrompt`; **không đụng** biến `vnd` ở dòng 28 là tỷ giá)
- `Webstie/server/src/services/assistant/pricing.ts:15` (`vnd`)

**Cầu nối server:** `Webstie/server/src/config/shared.js`. Thêm export `fold`, `extractSkus`, `matchingSkus`, `skuChoice`, `vnd`, `tr` kèm JSDoc `@type`. Build phải chạy được cả từ `src/config` lẫn `dist/config`, như comment trong file đang ghi.

**Phạm vi ảnh hưởng:** `fold` dùng khoảng 36 chỗ trong các file trên. `brands.fold` được import bởi `router.ts` và `pricing.ts`. Bộ lọc Telegram `lib/telegram-product-guard.js` còn được plugin Telegram nạp qua đường dẫn tuyệt đối (`scripts/install-telegram-product-guard.js`), nên plugin phải nạp được `require('../../shared/text')` khi không chạy từ thư mục BossTele.

**Test liên quan:**
- server: `assistantSku.test.ts`, `assistantRouter.test.ts`, `assistantPricing.test.ts`, `assistantBrands.test.ts`, `assistantTools.test.ts`, `catalogStore.test.ts`
- BossTele: `sku.test.js`, `telegram-bot.test.js`, `buy-price.test.js`, `listing-draft.test.js`, `market-lookup.test.js`, `telegram-product-guard.test.js`, `sale-price.test.js`, `close-price.test.js`
- Thêm mới: `shared/test/text.test.js`, `shared/test/money.test.js`

**Không đụng:** `server/src/sale-ai/**`, `frontend/**`, `BossTele/chat.js` `money`, `BossTele/vendor/**`, `server/src/v2/**`.

## Điểm còn cần quyết định
- `Webstie/.task-110-client-backup/` là bản sao lưu client cũ (đã gitignore, có `node_modules`). Có xoá để giải phóng dung lượng không: chờ Bảo trả lời, ngoài task này.
