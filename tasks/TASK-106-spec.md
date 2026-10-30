# TASK-106: BossTele và trợ lý web nhận mã Kiot có đuôi (SP025211_KG)

- Dự án: web + BossTele
- Người phụ trách: Codex (thực hiện), Claude (đặc tả, chạy test, review)
- Trạng thái: `ready`
- Ngày giao: 30/10/2026, theo báo lỗi của Bảo trên Telegram.

## Lỗi Bảo gặp

| Bảo gõ | Bot trả lời |
|---|---|
| "xem giá vốn SP025211_KG" | "Bạn cho mình SKU sản phẩm (ví dụ SP014899)…" |
| "xem giá vốn SP025211_KG" (lần 2) | "Không tìm thấy SKU **SP014899** trên KiotViet." |
| "xem giá vốn SP025211" | "Không tìm thấy SKU SP025211 trên KiotViet." |

KiotViet vừa đổi mã: danh mục web (`server/data/catalog-cache.json`, đồng bộ lúc 10:01 30/10) có **4.144 / 5.792 mã có đuôi**, ví dụ `SP025211_KG`, `SP025306_29102026`. Món `SP025211_KG` có trong danh mục.

## Nguyên nhân (Claude đã đọc code)

1. **Mẫu tìm mã `\bSP\d{4,}\b` không khớp mã có đuôi.** `_` là ký tự chữ, nên sau dãy số không có ranh giới `\b`. Gặp ở:
   - `server/src/services/assistant/pricing.ts:19` (`lastSku`);
   - `server/src/services/assistant/router.ts:49`;
   - `BossTele/telegram-bot.js:258, 279, 296, 324, 325`;
   - `BossTele/telegram-bot.js:146` (`parseMoney` bỏ mã khỏi chuỗi trước khi đọc tiền);
   - `BossTele/sale-price.js:72` (CLI `^SP\d{4,}$`).
2. **`lastSku` lấy mã từ cả tin nhắn của trợ lý.** Câu mẫu "ví dụ SP014899" bị coi là mã khách hỏi. `telegram-bot.js:325` cũng đọc lịch sử `histories`; kiểm xem có lẫn lượt của bot không.
3. **So khớp mã đúng từng ký tự.** `pricing.ts:37` dùng `item.sku === sku`, `tools.ts:153` dùng so sánh không phân biệt hoa thường. Gõ mã gốc `SP025211` thì không ra `SP025211_KG`.

## Yêu cầu

1. **Một hàm nhận mã dùng chung** cho mỗi gói:
   - một hàm trong `server/src/services/assistant/` (TS);
   - một hàm trong `BossTele/lib/` (CommonJS).

   Thay mọi chỗ ở mục Nguyên nhân bằng hàm này.
   - Mẫu: `SP` + ít nhất 4 số + tuỳ chọn một đuôi `_` + chữ/số (ví dụ `_KG`, `_29102026`). Không phân biệt hoa thường; trả về chữ hoa.
   - Không được nằm giữa một chuỗi chữ/số khác: dùng lookbehind/lookahead `[A-Za-z0-9]`, **không** dùng `\b`.
2. **Tìm sản phẩm theo mã:**
   - khớp đúng mã đầy đủ (không phân biệt hoa thường) trước;
   - nếu không có, và mã gõ vào **không có đuôi**: lấy các món có mã gốc trùng (`sku.split('_')[0]`), cùng quy ước `sapoSku` của Sale AI:
     - đúng **1 món** thì dùng món đó;
     - **nhiều món** thì không tự chọn: trả lời liệt kê các mã đầy đủ (tối đa 5) để Bảo chọn;
     - không có món nào thì báo không tìm thấy, giữ câu hiện tại.
   - Áp cho: `pricing.ts` (giá chốt/giá vốn), `tools.ts` `tinh_gia`, và các chỗ BossTele tra thẻ sản phẩm, giá chốt, giá sale (`sale-price.js` nhận mã gốc: tra danh mục để ra mã đầy đủ rồi mới tính).
3. **Chỉ lấy mã từ tin của người dùng**, không lấy từ tin của trợ lý/bot (`lastSku` trong `pricing.ts`; lịch sử ở `telegram-bot.js:325`).
4. `parseMoney` bỏ cả mã có đuôi trước khi đọc tiền, để "SP025211_29102026" không bị đọc thành số tiền.
5. Không đổi phần khác của câu trả lời, quyền xem giá vốn hay công thức giá.

## Test (thêm vào bộ test hiện có)

- Câu "xem giá vốn SP025211_KG": nhận đúng `SP025211_KG`, ra thẻ sản phẩm có giá vốn.
- "xem giá vốn SP025211" (mã gốc, chỉ 1 món): ra `SP025211_KG`.
- Mã gốc trùng 2 món (ví dụ `SP024387_23092026` và `SP024387_KG` trong dữ liệu giả): liệt kê để chọn, không tự chọn.
- Lịch sử có tin trợ lý chứa "ví dụ SP014899", người dùng chưa nêu mã: **không** dùng SP014899.
- `parseMoney("SP025211_29102026 khách trả 45tr")` = 45.000.000.
- Mã cũ không đuôi (`SP000009`) vẫn chạy như trước.

## Kiểm tra

- Claude sẽ chạy: `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` (server); `npm test` tại `Webstie/BossTele`.
- Codex chạy `-a never`: lệnh nào bị sandbox chặn (spawn EPERM) thì ghi lại, **không xin quyền**.

## Vùng code

- `Webstie/server/src/services/assistant/{pricing,router,tools}.ts` và test assistant trong `server/src/tests/`;
- `Webstie/BossTele/{telegram-bot,sale-price}.js`, `BossTele/lib/`, `BossTele/test/`.
- **Không đụng:** `Webstie/server/src/sale-ai/` (TASK-104 đang làm dở), `scripts/dev.mjs`, frontend.

## Kết quả

Ghi `tasks/TASK-106-result.md`: file đã sửa, test đã thêm, lệnh đã chạy hoặc bị chặn. Không commit.
