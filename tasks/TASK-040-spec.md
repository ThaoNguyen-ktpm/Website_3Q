# TASK-040 — BossTele hỏi rồi mới đề xuất giá chốt (PRICE-SYSTEM STEP 6)

- Dự án: BossTele
- Người phụ trách: Claude (đặc tả, review), Codex (code, test)
- Trạng thái:
  - **Phần 1 — cách trả lời, tương tác, góp ý:** Bảo duyệt bản nháp ngày 20/10/2026 và Claude đã làm theo yêu cầu trực tiếp của Bảo (`telegram-bot.js` `closeStart`/`closeStep`, `lib/price-feedback.js`, `test/close-price.test.js`; `npm test` 111/111).
  - **Phần 2 — tính giá (`close-price.js`):** `proposed`, Bảo hẹn tính sau; chờ chốt mục "Điểm còn cần quyết định".
- Hành động gần nhất, ngày 20/10/2026:
  - Bảo duyệt hướng làm qua câu hỏi:
    - bot hỏi khách trả bao nhiêu, mức lời tối thiểu lần này, có tra giá thị trường không;
    - độ ưa chuộng dựa trên Hot, tuổi tồn, số đã bán cùng mẫu và giá thị trường.
  - Bảo gửi lại kế hoạch PRICE-SYSTEM, bổ sung STEP 6: "áp dụng vào phần bossTele tính giá". Quy tắc dưới đây lấy theo kế hoạch đó và thay bảng sàn lời theo tuổi tồn đã đề xuất trước.
- Bước tiếp theo: Bảo chốt các quyết định → đổi trạng thái `ready` → Codex triển khai.

## Bối cảnh

Hiện tại hỏi "giá chốt" trên Telegram chỉ nhận câu cụt "Chưa đề ra giá chốt.", hoặc một phép tính vốn × (1 + %) (ảnh SP024640 Bảo gửi ngày 20/10). Bot không hỏi thêm và không xét độ ưa chuộng.

Nguồn quy tắc: `docs/reference/price-system-plan.txt` (kế hoạch của Bảo) và `docs/PRICE-SYSTEM.md`. Công việc này chỉ áp phần đã đủ rõ của kế hoạch vào **giá chốt đề xuất cho một lượt trao đổi**:
- không ghi giá lên Kiot/Sapo;
- không đổi công thức Sale AI;
- không dựng web app Price System (STEP 4–5).

## Quy tắc lấy từ kế hoạch

1. **Lợi nhuận mong muốn theo rank** (mục II), túi:

   | Rank | Lợi nhuận mong muốn |
   |---|---|
   | Dưới 50tr | 30% |
   | 50–100tr | 23% |
   | 100–150tr | 15% |
   | 150–200tr | 12,5% |
   | Trên 200tr | 10% (theo các ví dụ Cartier 500tr, VCA 300tr) |

   - Rank tính theo **giá vốn**: các ví dụ "thu 150tr → rank trên 150tr" và "offer 300tr → 10% → bán 330tr" đều tính trên giá vốn.
   - Lời tính trên vốn: giá = vốn × (1 + %). Ví dụ của kế hoạch là 150tr × 1,125 = 168tr7.
   - Đây là suy luận từ ví dụ; Bảo xác nhận ở Quyết định 1.
2. **Trigger sale tự động** (mục I): dùng nguyên Sale AI (M0, bước M, giá sale, quyền sale). Trigger chỉ tự động **tới giá vốn**. Dưới vốn phải có founder duyệt, nên bot không bao giờ đề xuất dưới vốn, chỉ ghi "cần Bảo/Nguyên duyệt".
3. **Hàng Hot trend** được xử lý riêng (mục II). Chi tiết ở Quyết định 3.

## Mục tiêu

Bảo hỏi "giá chốt SP…" hoặc "khách trả X, chốt được không". Bot:
1. hỏi phần còn thiếu, tối đa 2 câu ngắn;
2. chạy script để tính, không để Claude tự làm toán;
3. trả lời bằng một thẻ ảnh kèm 4–6 dòng.

## Phạm vi

1. Script mới `BossTele/close-price.js <SKU> [--offer N] [--margin P] [--model "từ khóa mẫu"] [--market N]`. Script chỉ đọc và in JSON:
   - **Dữ kiện:**
     - vốn (`cost` của catalog snapshot) và giá Kiot đang bán;
     - từ Sale AI: `type` (Hot), `ageDays`, `m`, `price` (giá sale hôm nay), `allowance`, `net`.
   - **Rank và lợi nhuận mong muốn** theo bảng ở mục Quy tắc 1. Có `--margin` (Bảo nhập lần này) thì dùng `--margin` thay cho bảng.
   - **Giá theo lợi nhuận mong muốn** `expected` = vốn × (1 + %), làm tròn lên (Quyết định 4).
   - **Mục tiêu** `target`:
     - hàng còn M0 hoặc Hot: `max(expected, giá sale)`;
     - hàng đã vào trigger (M ≥ 1): giá sale hôm nay của Sale AI.
   - **Sàn tự động** `floor`:
     - M0 hoặc Hot: `expected`;
     - M ≥ 1: `max(net, vốn)`, tức trigger chỉ tự động tới vốn.
   - **Lời của mức đề xuất**: số tiền và % trên vốn; so với lợi nhuận mong muốn của rank (đạt hay thiếu bao nhiêu %).
   - **Độ ưa chuộng:**
     - Hot (dấu `!`), tuổi tồn, mốc M;
     - cùng mẫu đã bán (khớp mọi từ của `--model`, nguồn theo Quyết định 2): số món, giá bán, day-to-sell;
     - giá thị trường `--market` (trung vị do nhánh tra thị trường đưa vào), chênh lệch so với `target`;
     - nhãn `uaChuong` = `cao` / `trung bình` / `thấp` theo Quyết định 5.
   - **Đề xuất theo giá khách trả:**
     - không có offer: báo `target` và `floor`;
     - offer ≥ target: chốt ở mức offer;
     - floor ≤ offer < target: trả ngược ở mức giữa offer và target. Ưa chuộng `cao` thì ở 2/3 quãng về phía target. Làm tròn lên, không dưới `floor`;
     - offer < floor: không chốt, trả ngược ở `floor`. Nếu offer < vốn thì ghi "dưới vốn — cần founder duyệt".
   - **Cảnh báo `warnings`:**
     - thiếu vốn: không có `expected`/`floor`;
     - Sale AI `status` khác `simulated`;
     - danh mục không phải túi: đang tạm dùng bảng của túi (Quyết định 3);
     - snapshot cũ hơn 24 giờ.
2. **Telegram** (`telegram-bot.js`):
   - Câu có "giá chốt" / "chốt" / "khách trả" đi nhánh Claude. Sửa `saleIntent` để nhánh sale không nuốt các câu này.
   - Thêm `Bash(node close-price.js:*)` vào `--allowedTools`.
   - System prompt hướng dẫn Claude:
     - chưa có giá khách trả → hỏi;
     - không nêu mức lời → dùng lợi nhuận mong muốn của rank và nói rõ điều đó;
     - hỏi có tra thị trường không (mất 1–3 phút); có thì dùng nhánh tra thị trường hiện có rồi truyền trung vị qua `--market`;
     - tự chọn `--model` từ tên sản phẩm: hãng + mẫu + kích thước, bỏ màu, ngày, ghi chú;
     - trả lời tối đa 6 dòng: mức chốt đề xuất, sàn, lời so với mong muốn, ưa chuộng (1 dòng lý do), cảnh báo;
     - gọi là "giá chốt đề xuất".
3. **Tài liệu:**
   - `docs/PRICE-SYSTEM.md`: ghi STEP 6 → TASK-040 và các quyết định Bảo chốt;
   - `docs/SALE-PRICE.md`, `docs/CHAT.md`;
   - `CLAUDE.md`/`AGENTS.md` của BossTele: thêm một dòng về `close-price.js`.

## Ngoài phạm vi

- Ghi giá lên Kiot/Sapo.
- Đổi công thức Sale AI.
- Đề xuất giá thu (trường hợp 3 của kế hoạch).
- Bot tự học hoặc lưu nhật ký báo giá.
- Web app Price System, đăng nhập, IP allowlist.
- Day-to-sell mong muốn theo danh mục (chưa có số; chỉ hiển thị dữ kiện).

## Yêu cầu

- Script chỉ đọc `server/data/catalog-cache.json` và kho Sale AI qua `sale-price.js`. Nếu Quyết định 2 chọn hóa đơn, script đọc thêm hóa đơn Kiot. Script không ghi file và không gọi API ghi.
- Mọi con số trong câu trả lời lấy từ JSON của script.
- Vốn và lời chỉ gửi trong chat riêng đã allowlist (như hiện tại).

## Tiêu chí nghiệm thu

1. SKU giả có vốn 51,5tr (rank 50–100tr, 23%):
   - `expected` = 63.345.000 → làm tròn lên 63.400.000;
   - với M0 và với M2, `target` và `floor` đúng theo quy tắc.
2. Các biên rank có test: 49.999.999 / 50.000.000 / 100tr / 150tr / 200tr / trên 200tr.
3. Bốn trường hợp offer có test, gồm offer dưới vốn ("cần founder duyệt").
4. Thiếu vốn, SKU không tồn tại và danh mục không phải túi đều có cảnh báo đúng.
5. Cùng mẫu đã bán: fixture cho kết quả đúng số món và day-to-sell; `uaChuong` đúng quy tắc.
6. Telegram:
   - "SP024640 giá chốt" → bot hỏi khách trả bao nhiêu;
   - "khách trả 58tr" → script được gọi với `--offer 58000000`;
   - "giá sale SP…" vẫn đi `saleAnswer`.
7. `npm test` tại `D:\Website_3Q\BossTele` đạt, test cũ không sửa kỳ vọng.

## Lệnh kiểm tra

- `npm test` tại `D:\Website_3Q\BossTele`.
- Chạy `node close-price.js SP024640 --offer 58000000 --model "Chanel Vanity Small"` trên snapshot thật (chỉ đọc), rồi đối chiếu tay với vốn và giá trên Kiot.

## Vùng code

- **Điểm vào:**
  - `BossTele/telegram-bot.js`: `saleIntent` dòng 101, `saleAnswer` dòng 184, system prompt và `--allowedTools` dòng 71–82, `handleUpdate` dòng 229;
  - `BossTele/sale-price.js` (`salePrices`, dòng 39–67);
  - `BossTele/catalog.js` (`cost` dòng 14, `searchCatalog` dòng 36);
  - `BossTele/lib/market-lookup.js` (`marketIntent`).
- **File mới:** `BossTele/close-price.js`, `BossTele/test/close-price.test.js`.
- **Phạm vi ảnh hưởng:**
  - `saleIntent`/`saleAnswer`: test `test/telegram-bot.test.js`, `test/market-lookup.test.js`;
  - `catalog.js`: test `test/catalog.test.js`.
- **Không đụng:** `D:\BaoQ-AI` (công thức và kho), đường ghi giá, web `server/` và `client/`.

## Điểm còn cần quyết định

1. **Bảng lợi nhuận:**
   - rank tính theo giá vốn, lời trên vốn, trên 200tr = 10%. Đúng ý Bảo không?
   - Biên đúng 50tr / 100tr / 150tr / 200tr thuộc rank trên hay rank dưới? Đề xuất: thuộc rank trên, tức 50tr ra 23%.
2. **Số đã bán cùng mẫu lấy từ đâu:**
   - catalog snapshot: món hết hàng, ngày bán gần đúng, không tốn lượt đọc Kiot;
   - hóa đơn Kiot: giá bán và ngày bán thật, đúng ý kế hoạch là "giá đã bán gần nhất, day-to-sell", nhưng làm thêm và tốn lượt đọc.
3. **Hàng Hot trend và hàng không phải túi:**
   - đề xuất Hot giữ sàn `expected` dù đã sang M ≥ 1;
   - danh mục khác tạm dùng bảng túi, kèm cảnh báo.
4. **Làm tròn:** đề xuất làm tròn lên bội 100.000đ.
5. **Nhãn ưa chuộng:**
   - đề xuất `cao` khi Hot, hoặc khi có ≥ 2 món cùng mẫu bán trong ≤ 30 ngày, hoặc khi giá thị trường ≥ target;
   - `thấp` khi M ≥ 3 và không có món cùng mẫu đã bán;
   - còn lại là `trung bình`.
