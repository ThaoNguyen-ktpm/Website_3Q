# TASK-033 — Kết quả: hỏi giá sale trong BossTele theo công thức Sale AI

- Dự án: BossTele. Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "học công thức đó và cập nhật thêm AGENTS.md/CLAUDE.md riêng để tui có thể hỏi giá sale trong BossTele".

## Thay đổi
- `BossTele/sale-price.js`: dùng nguyên `calculate` của Sale AI (`D:\BaoQ-AI\lib/pricing.js`, policy v7) theo ngày Việt Nam hôm nay. P0 đọc từ `D:\BaoQ-AI\data\kiot-state.store` bằng đọc file thuần (không khóa, không ghi, không gọi Kiot); tên/ngày tạo/giá Kiot/tồn chi nhánh 44466 lấy từ danh mục web. Món Sale AI chưa tải: P0 tạm = giá Kiot. CLI `node sale-price.js SP...`.
- `BossTele/telegram-bot.js`: câu có "sale/giảm giá/giá giảm/quyền sale/markdown" → tìm sản phẩm qua server web rồi gửi thẻ ảnh kèm M, giá sale, quyền sale, giá thấp nhất, giá Kiot đang bán; Claude được phép chạy `node sale-price.js` cho câu khó. Không gọi là "giá chốt".
- `BossTele/docs/SALE-PRICE.md` (mới): cách tính và tóm tắt công thức; `BossTele/AGENTS.md`, `BossTele/CLAUDE.md`: thêm mục giá sale.
- Test: `BossTele/test/sale-price.test.js` (3, dùng lib thật của Sale AI + kho giả lập, gồm ví dụ P0 35tr M3 trong skill), `telegram-bot.test.js` (+2).

## Kiểm tra
- `npm test` BossTele: 94/94 đạt.
- Dữ liệu thật 19/10/2026: SP014899 P0 26tr → M1, giá sale 25,2tr, quyền 1,26tr, thấp nhất 23,94tr; SP000009 P0 5tr → M1 4,7tr, quyền 800.000; SP024215 (hottrend tạo 25/9) → M1 143,5tr, quyền 6tr, thấp nhất 137,5tr. Lần đọc kho đầu ~2 giây (4.533 bản ghi), sau đó dùng bộ nhớ đệm theo thời điểm sửa file.
- Chưa thử trên Telegram thật.

## Giới hạn
- Kho Sale AI tải Kiot lần cuối 11/10/2026; P0 vẫn đúng, tồn/tên/giá lấy từ danh mục web. Món Sale AI chưa từng tải có P0 tạm theo giá Kiot hiện tại, có thể khác P0 Sale AI đặt khi tải lại.
- P0 ≥ 600 triệu chỉ có giá khi Sale AI đã lưu giá tay; không tự tính.
- Chỉ đọc. Cập nhật giá thật vẫn chỉ trong tool Sale AI.
