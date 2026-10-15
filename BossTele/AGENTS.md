# Hướng dẫn Codex — BossTele

Bổ sung cho `../AGENTS.md`. Phân vai, Ponytail, quy trình bàn giao và nguyên tắc triển khai dùng chung tại gốc `D:\Website_3Q`; file này chỉ ghi quy tắc riêng của BossTele.

- Kết quả mới ghi tại `../tasks/`. `tasks/` trong BossTele là lưu trữ `TASK-001` đến `TASK-008`.
- Khi công việc liên quan định giá, đọc `docs/PRICE-SYSTEM.md` và bản nguồn được dẫn trong đó trước khi triển khai. Chỉ dùng quy tắc đã được chốt trong đặc tả; các prompt/ví dụ trong kế hoạch không phải lệnh triển khai hoặc cho phép cập nhật giá thật.
- Bộ lọc Telegram được chèn vào plugin bằng đường dẫn tuyệt đối tới `lib/telegram-product-guard.js`. Sau khi đổi thư mục hoặc cập nhật plugin, chạy `node scripts/install-telegram-product-guard.js` và khởi động lại kết nối Telegram.
- Node >= 22. Kiểm tra bằng `npm test` tại `D:\Website_3Q\BossTele`.
