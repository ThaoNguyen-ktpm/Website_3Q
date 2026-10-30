# Hướng dẫn Codex — BossTele

Bổ sung cho `../AGENTS.md`. Phân vai, Ponytail, quy trình bàn giao và nguyên tắc triển khai dùng chung tại gốc `D:\Website_3Q`; file này chỉ ghi quy tắc riêng của BossTele.

- Kết quả mới ghi tại `../tasks/`. `tasks/` trong BossTele là lưu trữ `TASK-001` đến `TASK-008`.
- Khi công việc liên quan định giá, đọc `docs/PRICE-SYSTEM.md` và bản nguồn được dẫn trong đó trước khi triển khai. Chỉ dùng quy tắc đã được chốt trong đặc tả; các prompt/ví dụ trong kế hoạch không phải lệnh triển khai hoặc cho phép cập nhật giá thật.
- Bộ lọc Telegram được chèn vào plugin bằng đường dẫn tuyệt đối tới `lib/telegram-product-guard.js`. Sau khi đổi thư mục hoặc cập nhật plugin, chạy `node scripts/install-telegram-product-guard.js` và khởi động lại kết nối Telegram.
- Giá sale (TASK-033): BossTele dùng nguyên bộ tính `calculate` tại `../server/src/sale-ai/lib/pricing.js`, kho `../server/data/sale-ai/kiot-state.store` (TASK-104; `BAOQ_AI_DIR` cho phép ghi đè đường dẫn), không chép hay tự sửa công thức. TASK-105/TASK-109: trước 01/07/2026 không giảm; 01/07–15/10/2026 lên M1 từ 01/11/2026; từ 16/10/2026 giữ quy tắc thường/hot. `sale-price.js` chỉ đọc file kho Sale AI (không khóa, không ghi, không gọi Kiot). Tóm tắt và cách tính: `docs/SALE-PRICE.md`. Không gọi kết quả là "giá chốt" khi PRICE-SYSTEM chưa chốt.
- Giá chốt với khách (TASK-040): bot hỏi giá khách trả, code tính lời, Claude gợi ý một dòng, Bảo góp ý Hợp lý/Chưa đúng; góp ý lưu `data/price-feedback.jsonl`. Công thức tính giá chốt làm sau theo PRICE-SYSTEM.
- Trí nhớ bot Telegram (TASK-034): `lib/boss-memory.js`, dữ liệu `data/memory/` (gitignored, không xóa khi chưa được Bảo đồng ý). Mô tả trong `docs/CHAT.md`.
- Node >= 22. Kiểm tra bằng `npm test` tại `D:\Website_3Q\Webstie\BossTele`.
