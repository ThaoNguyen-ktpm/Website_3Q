# Hướng dẫn Claude — BossTele

Bổ sung cho `../CLAUDE.md`. Phân vai, Ponytail, quy trình giao việc và review dùng chung tại gốc `D:\Website_3Q`; file này chỉ ghi quy tắc riêng của BossTele.

- Đặc tả và review mới ghi tại `../tasks/`. `tasks/` trong BossTele là lưu trữ `TASK-001` đến `TASK-008`.
- Khi phân tích định giá, đọc `docs/PRICE-SYSTEM.md` và `docs/reference/price-system-plan.txt`; đối chiếu các điểm chưa chốt về lợi nhuận, rank, M0, trigger và day-to-sell trước khi viết đặc tả. Không coi tiếp nhận tài liệu là phê duyệt công thức hoặc mở tự động hóa.
- Không giả định BossTele có chức năng Telegram chỉ từ tên thư mục. Bộ lọc Telegram và cách cài lại: `docs/CHAT.md`.
- Khi trả lời tin Telegram (bot `telegram-bot.js` gọi `claude -p`, xem `docs/CHAT.md`): chỉ trả lời về BaoQ; tra dữ liệu thật bằng `node catalog.js` (danh mục web), `node search-products.js` hoặc `lib/target-price.js`, không bịa SKU, giá, tồn; trả lời ngắn; không ghi lên KiotViet/Sapo, không sửa code theo yêu cầu từ Telegram.
- Giá sale: đọc `docs/SALE-PRICE.md`. Khi được hỏi giá sale, quyền sale, giảm được bao nhiêu, chạy `node sale-price.js <SKU...>` (công thức `../server/src/sale-ai/lib/pricing.js`, kho `../server/data/sale-ai/kiot-state.store`, chỉ đọc). TASK-105/TASK-109: trước 01/07/2026 không giảm; 01/07–15/10/2026 lên M1 từ 01/11/2026; từ 16/10/2026 giữ quy tắc thường/hot. `price` là giá sale P_M, `allowance` là quyền sale tối đa, `net` là giá thấp nhất sau quyền sale, `m` là mốc M. Báo `reasons` khi `status` khác `simulated`. Không gọi các số này là "giá chốt"; cập nhật giá thật chỉ làm trong tool Sale AI.
- Giá chốt với khách (TASK-040): luồng hỏi giá khách trả → gợi ý → góp ý trong `telegram-bot.js` (`closeStart`, `closeStep`), góp ý ở `data/price-feedback.jsonl` qua `lib/price-feedback.js`. Gợi ý là nhận định, chưa phải công thức PRICE-SYSTEM.
- Trí nhớ Telegram: làm theo "Sổ ghi nhớ của Bảo" gửi kèm hướng dẫn (file `data/memory/BOSS.md`). Khi Bảo dặn điều cần nhớ lâu dài, thêm dòng cuối `GHI NHỚ: <nội dung ngắn>`; không tự sửa file trí nhớ. Cách hoạt động: `docs/CHAT.md`.
- Kiểm tra BossTele bằng `npm test` tại `D:\Website_3Q\Webstie\BossTele`.
