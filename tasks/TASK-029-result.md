# TASK-029 — Kết quả: Telegram nhận câu tự do về BaoQ

- Dự án: BossTele. Trạng thái: done, do Claude làm trực tiếp theo yêu cầu của Bảo ("ok thực hiện đi áp dụng vào trợ lý ảo của tui", 2026-10-19).
- Mục tiêu: câu tự do và câu khó về sản phẩm, giá, tồn kho, kinh doanh BaoQ trên Telegram được chuyển tới Claude Code (gói tháng, chỉ Bảo dùng); câu ngoài luồng vẫn bị chặn.

## Thay đổi
- `BossTele/lib/telegram-product-guard.js`: thêm `storeQuestion` (từ khóa có dấu cho từ dễ nhầm như "bán"/"bạn", từ khóa không dấu cho cụm rõ nghĩa, SKU `SP…`, thương hiệu). Vẫn chặn câu ghép `;`, ký tự điều khiển, hơn 500 ký tự, tệp đính kèm.
- `BossTele/test/telegram-product-guard.test.js`: thêm 1 test; test cũ giữ nguyên.
- `BossTele/docs/CHAT.md`, `BossTele/CLAUDE.md`: mô tả bộ lọc mới và cách phiên Telegram phải trả lời (dữ liệu thật, không ghi API).
- Đã chạy `node scripts/install-telegram-product-guard.js` (dòng chèn vào plugin không đổi).

## Kiểm tra
- `npm test` tại `BossTele`: 75/75 đạt.
- Chưa kiểm tra trên Telegram thật: cần khởi động lại `claude --channels plugin:telegram@claude-plugins-official`.

## Giới hạn
- Bộ lọc theo từ khóa, không hiểu nghĩa: câu ngoài luồng có chứa từ khóa vẫn lọt tới Claude.
- Trợ lý trên web vẫn dùng Ollama; gói tháng không dùng được cho web nhiều người.
