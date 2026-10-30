# TASK-107: BossTele/trợ lý trả lời "xem giá vốn"

- Dự án: web + BossTele
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`
- Ngày giao: 30/10/2026

## Lỗi

Bảo nhắn Telegram "xem giá vốn SP025211_KG". Bot trả "Chưa đề ra giá chốt." kèm thẻ sản phẩm (tên, mã, giá bán, tồn), **không có giá vốn**.

Nguyên nhân: `server/src/services/assistant/pricing.ts:10`, `pricingIntent` có `\bgia von\b`. Câu hỏi giá vốn vì thế đi vào nhánh giá chốt. Không có mức lời (`rate`), nên rơi xuống nhánh cuối `reply: 'Chưa đề ra giá chốt.'`.

## Yêu cầu

1. Tách **ý hỏi giá vốn** khỏi ý hỏi giá chốt. Ý hỏi giá vốn gồm: "giá vốn", "xem vốn", "vốn bao nhiêu", "vốn của SP…", "nhập giá bao nhiêu" (bỏ dấu, không phân biệt hoa thường).
   - Câu có cả "giá chốt" thì giữ luồng giá chốt hiện tại.
   - Câu "tính giá vốn=… chi_phí=…" (lệnh tính giá của BossTele) giữ nguyên.
2. Trả lời giá vốn, dùng lại cách tra sản phẩm và giá vốn đang có trong `pricing.ts`: `executeTool('tim_san_pham')`, đọc `cost` theo chi nhánh, nhận mã có đuôi và mã gốc như TASK-106.
   - Có quyền `products.cost` và có giá vốn: một dòng ngắn, ví dụ:
     `SP025211_KG: vốn 20.000.000đ · đang bán 26.000.000đ · lời 6.000.000đ (30%)`
     - Lời = giá bán − vốn; % = lời ÷ vốn. Dùng cùng định dạng tiền (`vnd`) và % như file đang dùng.
     - Các chi nhánh khác vốn: ghi vốn cao nhất và thêm "(chi nhánh khác nhau: …)".
     - Chưa có giá bán: chỉ ghi vốn.
   - Không có quyền `products.cost`: "Bạn không có quyền xem giá vốn." Giữ giá bán như hiện tại.
   - Chưa có giá vốn trên Kiot: "SP… chưa có giá vốn trên KiotViet. Giá bán hiện tại …".
   - Vẫn gửi kèm thẻ sản phẩm (`products`) như hiện tại.
3. Không có mã trong câu thì hỏi lại mã như hiện tại. Không lấy mã từ tin của bot (TASK-106).
4. Kiểm luồng BossTele (`BossTele/telegram-bot.js`): câu "xem giá vốn SP…" đi qua trả lời mã của trợ lý web (`/internal/assistant`). Nếu BossTele có nhánh riêng chặn trước, sửa để ra cùng kết quả.

## Test

Thêm vào test assistant hiện có (`server/src/tests/`):
- "xem giá vốn SP025211_KG", có quyền: ra dòng vốn, giá bán, lời, %.
- "xem giá vốn SP025211" (mã gốc), có quyền: ra đúng món `_KG`.
- Không có quyền `products.cost`: báo không có quyền, không lộ số vốn.
- Chưa có giá vốn: báo chưa có.
- "SP025211_KG giá chốt": vẫn ra "Chưa đề ra giá chốt." như cũ.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn (spawn EPERM) thì ghi lại, không xin quyền. Claude sẽ chạy `npm run build`, `npm test` tại `Webstie` và `npm test` tại `Webstie/BossTele`.
- Không đụng `server/src/sale-ai/`, `scripts/dev.mjs`, frontend. Không đổi thay đổi chưa commit của task khác. Không commit.
- Ghi `tasks/TASK-107-result.md`.
