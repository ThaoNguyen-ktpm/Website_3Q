# Giá sale trong BossTele (công thức Sale AI)

TASK-033, 19/10/2026. BossTele trả lời "giá sale" bằng **chính bộ tính của tool Sale AI** tại `D:\BaoQ-AI` (`lib/pricing.js`, hàm `calculate`, policy `baoq-2026-10-19-start01-v8`). Nguồn quy tắc duy nhất: `D:\BaoQ-AI\.cursor\skills\baoq-pricing\SKILL.md` và `D:\BaoQ-AI\docs\CURRENT.md`. Bảng dưới là bản tóm tắt để đọc nhanh; khi khác nhau, Sale AI đúng.

## Cách BossTele tính

- `node sale-price.js SP014899 [SP...]` in JSON: `m`, `ageDays`, `type`, `p0`, `price` (giá sale P_M), `allowance` (quyền sale tối đa D_sale), `net` (P_M − D_sale), `currentPrice` (giá Kiot đang bán), `stock`, `status`, `reasons`, `p0Source`.
- P0 đọc từ kho Sale AI `D:\BaoQ-AI\data\kiot-state.store` (manifest + blobs) bằng đọc file thuần: không khóa kho, không ghi, không gọi Kiot. Đổi thư mục bằng biến `BAOQ_AI_DIR`.
- Tên, ngày tạo, giá Kiot và tồn **chi nhánh 44466** lấy từ danh mục web `server/data/catalog-cache.json` (mới hơn lần tải cuối của Sale AI). Không có danh mục web thì dùng dữ liệu Sale AI.
- Món Sale AI chưa tải (nhập sau lần tải cuối): P0 tạm = giá Kiot hiện tại, giống cách Sale AI khởi tạo P0; thẻ ghi "tạm theo giá Kiot".
- Ngày xét = ngày Việt Nam hôm nay. `status` khác `simulated` thì báo `reasons` (hết tồn, thiếu P0, P0 ≥ 600 triệu chưa có giá tay…), không tự đoán giá.
- Telegram: câu có "sale", "giảm giá", "giá giảm", "quyền sale", "markdown" → bot tìm sản phẩm như tra cứu thường rồi gửi thẻ ảnh kèm M, giá sale, quyền sale, giá thấp nhất, giá Kiot đang bán. Câu khó thì Claude chạy `node sale-price.js`.
- Chỉ đọc và báo số. Cập nhật giá thật lên Kiot/Sapo vẫn chỉ làm trong tool Sale AI, do Bảo chọn và bấm.
- Không gọi `net` là "giá chốt": chính sách giá chốt (PRICE-SYSTEM) chưa được chốt; dùng "giá thấp nhất sau quyền sale".

## Tóm tắt công thức (Sale AI v8)

**Tuổi và M.** Ngày bắt đầu = max(ngày tạo Kiot theo giờ Việt Nam, 01/10/2026) (đổi từ 13/10 ngày 19/10/2026, TASK-039); tuổi = số ngày từ ngày bắt đầu. Bước 15 ngày, tối đa M6.
- Tạo trước 01/10/2026 (cả thường/hottrend): M = min(6, 1 + floor(tuổi/15)).
- Tạo từ 01/10/2026: thường M = min(6, floor(tuổi/15)); hottrend (tên có `!`) M = min(6, floor(max(0, tuổi − 30)/15)), tức M0 kéo dài 45 ngày.

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

**Ví dụ (từ skill Sale AI).** P0 35tr, hàng thường tạo trước 01/10, xét 12/11/2026: M3, giá sale 32,4tr, quyền 972.000, thấp nhất 31,428tr. Thật ngày 19/10/2026 (mốc 01/10): SP014899 P0 26tr, tuổi 18, M2, giá sale 24,4tr, quyền 1,22tr, thấp nhất 23,18tr.

## Giá chốt với khách

Giá chốt với khách (TASK-040, Bảo 20/10/2026): "SP… giá chốt" (hoặc "khách trả…", "giá chốt nên là nhiu" ngay sau một thẻ) → bot gửi thẻ có giá bán, vốn, lời, tuổi tồn, M, Hot, Sale AI, rồi hỏi khách trả bao nhiêu (nút Tra giá thị trường, Bỏ qua). Gõ giá (58tr, 58,5 triệu, 58tr5, 58.000.000) → dòng lời/thấp hơn giá bán do code tính, kèm một dòng gợi ý của Claude dựa trên dữ kiện và góp ý cũ. Nút Hợp lý / Chưa đúng → Chưa đúng thì Bảo gõ giá chốt và lý do. Góp ý lưu ở `BossTele/data/price-feedback.jsonl` (không vào git), lần sau hỏi cùng SKU hoặc cùng mẫu (3+ chữ trùng trong tên) Claude đọc lại. Công thức giá chốt chưa có (PRICE-SYSTEM, TASK-040 phần tính giá để sau); gợi ý không phải công thức.

## Kiểm tra

`npm test` tại `BossTele`: `test/sale-price.test.js` dùng `lib/` thật của Sale AI với kho giả lập (tự bỏ qua khi không có `D:\BaoQ-AI`), `test/telegram-bot.test.js` cho luồng Telegram.
