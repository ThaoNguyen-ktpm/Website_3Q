# TASK-034 — Kết quả: trí nhớ cho BossTele

- Dự án: BossTele. Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "Thêm trí nhớ trực tiếp vào BossTele cho nó skill trí nhớ cho boss" (thay vì dùng CoPaw/QwenPaw, vốn không chạy bằng gói Claude).

## Thay đổi
- `BossTele/lib/boss-memory.js` (mới): sổ `data/memory/BOSS.md` (thêm/quên/xem, tối đa 50 ghi chú, mỗi ghi chú 300 ký tự) và lịch sử từng chat `data/memory/chat-<id>.json` (20 lượt + phiên Claude).
- `BossTele/telegram-bot.js`: nạp lịch sử khi bot khởi động lại; lệnh `nhớ:`, `quên:`, `/nho` (xử lý bằng code); Claude nhận sổ ghi nhớ trong system prompt và 10 lượt gần nhất (cả câu trả lời bằng code); dòng `GHI NHỚ:` trong câu trả lời của Claude được lưu vào sổ và thay bằng "(Đã ghi nhớ: …)"; hướng dẫn /start và menu lệnh thêm mục Ghi nhớ.
- `BossTele/.gitignore`: thêm `data/`. Tài liệu: `docs/CHAT.md`, `CLAUDE.md`, `AGENTS.md` của BossTele.
- Test: `telegram-bot.test.js` +3 (lệnh trí nhớ, Claude nhận ghi chú/bối cảnh + GHI NHỚ, bot khởi động lại vẫn nhớ).

## Kiểm tra
- `npm test` BossTele: 99/99 đạt.
- Thật với Claude (thư mục trí nhớ tạm): "từ giờ báo giá cho tui theo đơn vị triệu" → Claude trả lời và ghi "Báo giá theo đơn vị triệu cho gọn (vd 45,5 triệu)" vào BOSS.md (12,7 giây); câu sau "giá sale SP014899…" trả lời bằng triệu (25,2 triệu, quyền 1,26 triệu, thấp nhất 23,94 triệu) (16,7 giây).
- Chưa thử trên Telegram thật.

## Giới hạn
- Trí nhớ là file trên máy chạy bot; chuyển máy thì chép `BossTele/data/memory/`.
- Câu dặn không có từ khóa cửa hàng (ví dụ "gọi tui là anh Bảo") vẫn bị bộ lọc chặn; dùng `nhớ: …` cho những điều này.
