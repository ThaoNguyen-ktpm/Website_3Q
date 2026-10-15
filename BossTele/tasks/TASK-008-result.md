# TASK-008 — Kiểm tra chặn câu hỏi ngoài sản phẩm

- Người phụ trách: Codex.
- Trạng thái: ready_for_review; đã cài bản sửa Telegram, cần khởi động lại kết nối để nạp mã mới.
- Yêu cầu: chỉ nhận câu hỏi liên quan sản phẩm; chặn ví dụ “tôi muốn đi chơi z”.
- Hành động gần nhất: người dùng xác nhận lỗi ở bot Telegram; nối bộ lọc vào plugin đang cài và kiểm tra bằng mock.

## Kết quả
- Bộ lọc sẵn có trong `lib/chat-session.js` đã từ chối câu này trước API/AI. Không tìm thấy mã xử lý tin Telegram trong ứng dụng hiện tại; `chat.js` là caller runtime của session.
- `lib/chat-commands.js`: thông báo rõ chỉ hỗ trợ tra cứu và tính giá sản phẩm, không xử lý câu ngoài phạm vi.
- Bổ sung theo yêu cầu: bỏ câu “Gõ ‘trợ giúp’ để xem mẫu” khỏi thông báo từ chối dùng chung cho terminal và Telegram; giữ ví dụ trực tiếp của Telegram.
- `test/chat.test.js`: bổ sung “tôi muốn đi chơi z”, “tôi muốn đi chơi”, “toi muon di choi z” vào kiểm thử chặn; xác nhận action=blocked, searchCalls=0, modelCalls=0 và apiRequests=0 với provider spy bật.
- `docs/CHAT.md`: nêu ví dụ và phạm vi áp dụng của bộ lọc.
- Nguyên nhân Telegram: `handleInbound` của plugin `telegram@claude-plugins-official` 0.0.7 chuyển mọi tin đã qua access gate sang notification chat của Claude, không gọi parser BossTele.
- `lib/telegram-product-guard.js`: chỉ cho văn bản khớp parser hiện có đi qua; từ chối ngoài luồng/media bằng câu cố định có ví dụ. Lỗi gửi câu từ chối không cho tin rơi tiếp xuống Claude.
- `scripts/install-telegram-product-guard.js`: tìm đúng plugin từ registry, tạo backup, chèn bộ lọc sau access/permission gate và trước typing/download/notification; từ chối cấu trúc lạ, không chèn trùng.
- Đã chạy installer thành công với quyền ngoài workspace được hệ thống cho phép, sửa và đọc lại `C:/Users/Admin/.claude/plugins/cache/claude-plugins-official/telegram/0.0.7/server.ts`. Không đọc token, không gửi tin thật, không đổi access list.
- `test/telegram-product-guard.test.js`: 4 kiểm thử mới cho câu ngoài luồng sau câu hợp lệ, lệnh sản phẩm, media caption, lỗi reply và thứ tự chèn bộ lọc.

## Kiểm tra
- `npm.cmd test` trong sandbox: không khởi chạy được các test file do spawn EPERM.
- Chạy lại `npm.cmd test` ngoài sandbox được hệ thống cho phép: 60/60 đạt, 0 lỗi; API/model dùng mock.
- Sau thay đổi Telegram: `node --test --test-isolation=none test/telegram-product-guard.test.js`: 4/4 đạt; `npm.cmd test` ngoài sandbox: 64/64 đạt.
- Sau khi bỏ câu gợi ý trợ giúp: `node --test --test-isolation=none test/chat.test.js test/telegram-product-guard.test.js`: 18/18 đạt. Chưa kiểm tra lại tin Telegram thật.
- Trích đúng hàm `handleInbound` từ file plugin đã cài, dùng `stripTypeScriptTypes` + VM chạy với mock Telegram/MCP: câu “tôi muốn đi chơi z” không phát notification; ảnh có caption lệnh không tải file và không phát notification; lệnh tìm tên phát 1 notification; phản hồi cấp phép vẫn được chuyển đúng. Lần đầu mock thiếu `setMessageReaction` nên probe lỗi; bổ sung mock và chạy lại đạt. Đây là mô phỏng, không phải thử trên bot thật.

## Giới hạn và bước tiếp theo
- Chưa khởi động lại phiên Claude đang kết nối Telegram; tiến trình cũ chưa nạp bản sửa. Cần thoát phiên cũ và chạy lại `claude --channels plugin:telegram@claude-plugins-official` từ PowerShell tại BossTele.
- Chưa gửi tin kiểm tra trên Telegram thật; chưa có review độc lập của Claude cho thay đổi này.
- Câu sản phẩm tự do phải đổi sang mẫu parser; tin hợp lệ vẫn được chuyển sang Claude. Bộ lọc không phải phân loại ngữ nghĩa bằng AI.
- Cập nhật plugin có thể ghi đè bản sửa; chạy lại installer và khởi động lại kết nối. Plugin phụ thuộc đường dẫn checkout BossTele hiện tại.
- Không thay chính sách định giá, credential hoặc dữ liệu ngoài máy.
