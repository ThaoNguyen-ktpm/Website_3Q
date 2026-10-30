# Giá sale trong BossTele (công thức Sale AI)

BossTele trả lời "giá sale" bằng **chính bộ tính Sale AI** tại `Webstie/server/src/sale-ai/lib/pricing.js` (hàm `calculate`, policy `baoq-2026-10-30-hide-before-jul-v10`). Quy tắc hiện hành: TASK-105 và TASK-109. Bảng dưới tóm tắt code nguồn; khi khác nhau, Sale AI đúng.

## Cách BossTele tính

- `node sale-price.js SP014899 [SP...]` in JSON: `m`, `ageDays`, `type`, `p0`, `price` (giá sale P_M), `allowance` (quyền sale tối đa D_sale), `net` (P_M − D_sale), `currentPrice` (giá Kiot đang bán), `stock`, `status`, `reasons`, `p0Source`.
- P0 đọc từ kho Sale AI `Webstie/server/data/sale-ai/kiot-state.store` (manifest + blobs) bằng đọc file thuần: không khóa kho, không ghi, không gọi Kiot. `BAOQ_AI_DIR` ghi đè thư mục mã Sale AI; khi dùng biến này, kho được tìm trong `data/kiot-state.store` dưới thư mục đó.
- Tên, ngày tạo, giá Kiot và tồn **chi nhánh 44466** lấy từ danh mục web `server/data/catalog-cache.json` (mới hơn lần tải cuối của Sale AI). Không có danh mục web thì dùng dữ liệu Sale AI.
- Món Sale AI chưa tải (nhập sau lần tải cuối): P0 tạm = giá Kiot hiện tại, giống cách Sale AI khởi tạo P0; thẻ ghi "tạm theo giá Kiot".
- Ngày xét = ngày Việt Nam hôm nay. `status` khác `simulated` thì báo `reasons` (hết tồn, thiếu P0, P0 ≥ 600 triệu chưa có giá tay…), không tự đoán giá.
- Telegram: câu có "sale", "giảm giá", "giá giảm", "quyền sale", "markdown" → bot tìm sản phẩm như tra cứu thường rồi gửi thẻ ảnh kèm M, giá sale, quyền sale, giá thấp nhất, giá Kiot đang bán. Câu khó thì Claude chạy `node sale-price.js`.
- Chỉ đọc và báo số. Cập nhật giá thật lên Kiot/Sapo vẫn chỉ làm trong tool Sale AI, do Bảo chọn và bấm.
- Không gọi `net` là "giá chốt": chính sách giá chốt (PRICE-SYSTEM) chưa được chốt; dùng "giá thấp nhất sau quyền sale".

## Tóm tắt công thức hiện hành (TASK-105, TASK-109)

**Tuổi và M.** Ngày tạo Kiot theo giờ Việt Nam; bước 15 ngày, tối đa M6.
- Tạo trước 01/07/2026: không giảm (`excluded`, `before_no_markdown`); TASK-109 ẩn khỏi bảng Sale AI nhưng giữ hồ sơ/P0. BossTele vẫn trả lý do không giảm khi hỏi mã.
- Tạo 01/07–15/10/2026 (kể cả hai đầu): trước 01/11 là M0; từ 01/11 là M1, 16/11 M2, 01/12 M3, 16/12 M4, 31/12 M5, 15/01/2027 M6. Hàng hot tính như thường; tuổi sale tính từ 01/11.
- Tạo từ 16/10/2026: tuổi tính từ ngày tạo; thường M = min(6, floor(tuổi/15)); hottrend (tên có `!`) M = min(6, floor(max(0, tuổi − 30)/15)), tức M0 kéo dài 45 ngày.

**Giá sale P_M = P0 − tổng mức giảm M1..M** (triệu VND, theo nhóm P0; M0 không giảm):

| P0 (triệu) | M1 | M2 | M3–M6 mỗi mốc |
|---|---:|---:|---:|
| <2 | 0 | 0 | 0 |
| 2–<5 | 0,2 | 0,2 | 0,2 |
| 5–<10 | 0,3 | 0,3 | 0,5 |
| 10–<20 | 0,5 | 0,5 | 0,7 |
| 20–<50 | 0,8 | 0,8 | 1 |
| 50–<100 | 1,5 | 1,5 | 1,5 |
| 100–<150 | 2,5 | 2,5 | 2,5 |
| 150–<200 | 3 | 3 | 3 |
| 200–<250 | 4 | 4 | 4 |
| 250–<300 | 5 | 5 | 5 |
| 300–<400 | 7 | 7 | 7 |
| 400–<500 | 8 | 8 | 8 |
| 500–<600 | 10 | 10 | 10 |
| ≥600 | giá tay đã lưu, không tự tính | | |

**Quyền sale D_sale tại M0–M2:** P0 <5tr: 0; 5–<10tr: 800.000; 10–<20tr: 1.000.000; 20–<100tr: 5% × P_M; 100–<150tr: 6tr; 150–<200tr: 7tr; 200–<300tr: 8tr; 300–<400tr: 10tr; 400–<600tr: 15tr. M3: <5tr 0; 5–<100tr 3% × P_M; 100–<600tr một nửa mức trên. M4–M6: 0.

**Ví dụ theo TASK-105.** P0 35tr, tạo 20/08/2026 (thường hoặc hot), xét 01/11/2026: M1, giá sale 34,2tr, quyền sale 1,71tr, thấp nhất sau quyền sale 32,49tr. Tạo trước 01/07/2026 thì không tính giảm và không ghi giá.

## Giá chốt với khách

Giá chốt với khách (TASK-040, Bảo 20/10/2026): "SP… giá chốt" (hoặc "khách trả…", "giá chốt nên là nhiu" ngay sau một thẻ) → bot gửi thẻ có giá bán, vốn, lời, tuổi tồn, M, Hot, Sale AI, rồi hỏi khách trả bao nhiêu (nút Tra giá thị trường, Bỏ qua). Gõ giá (58tr, 58,5 triệu, 58tr5, 58.000.000) → dòng lời/thấp hơn giá bán do code tính, kèm một dòng gợi ý của Claude dựa trên dữ kiện và góp ý cũ. Nút Hợp lý / Chưa đúng → Chưa đúng thì Bảo gõ giá chốt và lý do. Góp ý lưu ở `BossTele/data/price-feedback.jsonl` (không vào git), lần sau hỏi cùng SKU hoặc cùng mẫu (3+ chữ trùng trong tên) Claude đọc lại. Công thức giá chốt chưa có (PRICE-SYSTEM, TASK-040 phần tính giá để sau); gợi ý không phải công thức.

## Kiểm tra

`npm test` tại `Webstie/BossTele`: `test/sale-price.test.js` dùng `lib/` thật trong `../server/src/sale-ai/` với kho giả lập, `test/telegram-bot.test.js` cho luồng Telegram.
