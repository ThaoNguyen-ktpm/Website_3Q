Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-131 — Review

- Dự án: web và BossTele
- Người review: Claude · Ngày: 03/11/2026
- Trạng thái: `verified` (phần test và kiểm bằng lệnh). Chưa hỏi thử bot Telegram thật, xem Giới hạn.
- Bước tiếp theo: Bảo khởi động lại bot khi tiện để bot dùng code mới.

## Phạm vi đã xem
Đặc tả `TASK-131-spec.md`, result của Codex, các file: `shared/text.js`, `shared/sku.js`, `shared/money.js`, `server/src/config/shared.js`, `server/src/services/assistant/{brands,pricing,graph,tools,router}.ts`, `server/src/services/catalogStore.ts`, `BossTele/{telegram-bot,catalog,sale-price}.js`, `BossTele/lib/*` và test liên quan.

## Bằng chứng (Claude tự chạy)
- Tiêu chí 1: `grep -rnF "normalize('NFD')"` trên shared, server/src, BossTele/*.js, BossTele/lib chỉ còn `shared/text.js:3`.
- Tiêu chí 2: `server/src/services/assistant/sku.ts` và `BossTele/lib/sku.js` đã xoá; `extractSkus` chỉ định nghĩa ở `shared/sku.js:4`.
- Tiêu chí 3: không còn `const vnd = value =>` / `const tr = value =>` trong 4 file đã nêu.
- `npm run build` tại `Webstie`: exit 0.
- `npm test` tại `Webstie`: exit 0. Shared 32/32, server Vitest 490 đạt (18 skipped), Sale AI 413/413.
- `npm test` tại `Webstie/BossTele`: 112/112.
- Chạy thử từ thư mục khác (`cd /`, nạp bằng đường dẫn tuyệt đối như plugin Telegram): `telegram-product-guard`, `telegram-bot`, `buy-price` nạp được. Kết quả: `fold('Túi ĐỒNG hồ')` = `tui dong ho`, `fold(null)` = `''`, `vnd(46000000)` = `46.000.000đ`, `tr(47600000)` = `47,6tr`, `extractSkus('sp014899_2 và SP1234')` = `['SP014899_2','SP1234']`.
- `brands.ts` giữ hành vi bỏ ký tự không phải chữ/số; `pricing.ts` giữ comment của `light`.

## Phát hiện
- Thấp: `server/src/services/assistant/pricing.ts:4-6` import từ `../../config/shared.js` hai lần (một lần lấy `fold as light`). Chạy đúng, chỉ là gộp được thành một dòng. Không chặn nghiệm thu.

## Giới hạn
- Chưa hỏi thử bot Telegram thật hay trợ lý web thật (tiêu chí 5). Bot đang chạy vẫn dùng code cũ đến khi khởi động lại. Hành vi được bảo đảm bằng test hiện có, không sửa kỳ vọng.

## Kết luận
Đạt. Không cần sửa.
