# TASK-032 — Kết quả: bot Telegram dùng chung luồng trả lời của trợ lý web, có ảnh

- Dự án: web + BossTele. Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "tối ưu tốc độ và có ảnh như web".

## Thay đổi
- `server/src/services/assistant/graph.ts`: tách `quickAnswer` (sửa chính tả thương hiệu, giá chốt, tra sản phẩm, "mẫu khác") khỏi `chat`; `chat` gọi lại đúng phần này, hành vi web không đổi.
- `server/src/routes/internalRoutes.ts` + `app.ts` + `config/env.ts`: `POST /internal/assistant`, ngoài `/api` (Vite không proxy), chỉ nhận loopback và header `x-internal-token` = `INTERNAL_TOKEN` (so sánh timing-safe); sai thì 404. Quyền cố định `products.view` + `products.cost` (bot chỉ cho Bảo).
- `scripts/dev.mjs`: tạo `INTERNAL_TOKEN` ngẫu nhiên mỗi lần chạy (giữ nếu đã đặt sẵn), truyền cho server và bot.
- `BossTele/telegram-bot.js`: câu không phải lệnh → hỏi server trước; có kết quả thì gửi dòng tóm tắt + mỗi sản phẩm một thẻ ảnh `sendPhoto` (tên, SKU, giá, tồn, Hot; ảnh lỗi thì thẻ chữ); gợi ý → nút trả lời; giữ 10 lượt gần nhất cho "mẫu khác". Server trả "Không tìm thấy sản phẩm…" hoặc không trả lời được → Claude như trước.
- Test: `server/src/tests/internalApi.test.ts` (3), `BossTele/test/telegram-bot.test.js` (+3).

## Kiểm tra
- `npm run build` đạt; `npm test` web 27 file / 401 test đạt; BossTele 87/87 đạt.
- Thật qua server đang chạy: sai token → 404; "túi chanel còn hàng" 166 ms, 10 sản phẩm đều có ảnh; "mẫu khác" 129 ms (11–20/190); "túi chanell" 5 ms → gợi ý "Chanel". Trước đó qua Claude khoảng 15 giây/câu.
- Chưa xem thẻ ảnh trên Telegram thật.

## Giới hạn / việc sau
- Bộ tra sản phẩm của web hiểu nhầm câu so sánh ("giá túi Hermes so với Chanel") thành tra sản phẩm và báo không tìm thấy; bot đã chuyển các câu này cho Claude, nhưng trợ lý web vẫn trả lời sai.
- Mỗi danh sách gửi tối đa 10 thẻ ảnh (10 tin nhắn).
- `catalog.js` vẫn là công cụ dữ liệu cho Claude ở câu khó (logic lọc lặp lại một phần `tools.ts`).
