# TASK-030 — Kết quả: bot Telegram riêng cho BossTele

- Dự án: BossTele (+ `scripts/dev.mjs` của web). Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "Làm bot Telegram riêng cho BossTele: tự trả lời lệnh tra cứu, câu tự do thì gọi claude -p bằng gói tháng của tôi".
- Lý do: `claude --channels` báo `Channels are not currently available` kể cả sau khi khởi động lại máy với môi trường sạch; mã Claude Code 2.1.299 cho thấy cờ máy chủ `tengu_harbor` đang tắt cho tài khoản. Lịch sử phiên chưa từng có tin Telegram thật tới Claude.

## Thay đổi
- `BossTele/telegram-bot.js`: long-poll Telegram; chỉ chat riêng với người trong `allowFrom`; lệnh → `createChatSession` + `render`; câu tự do qua `storeQuestion` → `claude -p` (`--session-id`/`--resume` theo chat, làm mới sau 30 phút, chỉ cho phép `Bash(node search-products.js:*)`, bỏ biến `CLAUDE_CODE_*`); tách tin dài 4000 ký tự.
- `BossTele/test/telegram-bot.test.js`: 5 test (người lạ/nhóm, lệnh, câu tự do + hội thoại, từ chối, lỗi Claude + tách tin).
- `scripts/dev.mjs` + `package.json` (`npm run dev`): chạy API, web và bot; bot lỗi không tắt web; `BOSSTELE=0` để bỏ bot.
- `~/.claude/settings.json`: tắt `telegram@claude-plugins-official` (backup `settings.json.before-bosstele-bot.bak`), vì plugin giành bot ở mọi phiên Claude, kể cả `claude -p`.
- `BossTele/docs/CHAT.md`, `BossTele/CLAUDE.md`: cập nhật.

## Kiểm tra
- `npm test` tại `BossTele`: 80/80 đạt.
- `claude -p` thật từ Node: tra SP014899 đúng (26.000.000đ, còn 1), 13 giây.
- `npm run dev`: API 4000, web 5173, bot chạy không lỗi `Conflict`.
- Chưa có tin nhắn Telegram thật qua bot lúc ghi file này.

## Giới hạn
- Xử lý tuần tự từng tin; câu tự do tốn lượt gói Claude của Bảo; chỉ Bảo dùng (điều khoản gói cá nhân).
- Bộ lọc câu tự do theo từ khóa.
