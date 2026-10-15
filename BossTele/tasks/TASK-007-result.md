# TASK-007 — Kết quả triển khai

- Người phụ trách: Codex; Claude review độc lập sau khi bàn giao.
- Trạng thái: ready_for_review.
- Hành động gần nhất: triển khai chat theo mẫu, cache, phân số BigInt và AI disabled; 60/60 test đạt.
- Bước tiếp theo: Claude review code và bằng chứng live.

## Thay đổi
- `chat.js` + `npm.cmd run chat`: terminal, hiển thị gọn, xử lý tuần tự, lọc ký tự điều khiển trong dữ liệu hiển thị.
- `lib/chat-commands.js`: whitelist mẫu câu, giới hạn 500 ký tự, từ chối sai/ngoài luồng trước nghiệp vụ.
- `lib/target-price.js`: BigInt cho phép tính thập phân chính xác và ceiling VND; không tự dùng chính sách giá chưa chốt.
- `lib/search-cache.js` + `lib/chat-session.js`: cache 120 giây/50 entries theo nguồn+truy vấn+trang, 10 dòng/màn hình, đọc buffered trước API mới, lỗi nguồn độc lập, giữ ID riêng và xóa phép tính khi đổi sản phẩm.
- `lib/pricing-ai.js`: seam provider mặc định tắt, bộ đếm calls, payload whitelist không có chat gốc/khóa/lịch sử.
- `lib/product-search.js`: thêm startPage và hasMore/nextPage để chat quét SKU Sapo từng trang; các caller cũ mặc định startPage=1.
- `test/chat.test.js`: 14 test mới; tổng toàn dự án 60 test.
- `docs/CHAT.md`: hướng dẫn và giới hạn.

## Kiểm chứng
- `npm.cmd test`: 60/60 đạt; log `TASK-007-tests.txt`. Transport API trong test là giả lập; không gọi model.
- Test blocked input xác nhận API=0 và provider=0 kể cả seam có provider spy; AI mặc định tắt và analysis đủ điều kiện vẫn calls=0.
- Test tính 150 triệu với markup 12,5% = 168.750.000; margin 12,5% = 171.428.572 sau làm tròn lên; test tiền vượt Number.MAX_SAFE_INTEGER và tỷ lệ thập phân rất nhỏ.
- Test lỗi nguồn, paging rỗng, SKU Sapo chuyển page, LRU/TTL, chọn đúng dòng và dữ liệu stale.
- Test stream UTF-8 CLI đạt. Pipe PowerShell ban đầu làm sai mã hóa tiếng Việt; tài liệu ghi cách đặt OutputEncoding UTF-8 khi dùng pipe.
- Live ngày 2026-10-14 qua .env, không in khóa: tìm tên Chanel trả đúng 10 dòng từ cả Kiot/Web, còn kết quả; xem thêm trả 10 dòng với 0 request API bổ sung; SKU Kiot SP022466 tìm được; SKU Sapo lấy từ trang tên cũng tìm được và vẫn cảnh báo chưa quét hết. Report `TASK-007-live.json`.
- Live chọn sản phẩm + tính giá + phân tích: giá mục tiêu 168750000 VND; AI disabled và calls=0. Đây là công thức nhập thử, không đề xuất giá thị trường cho sản phẩm thật.

## Giới hạn
- Runtime AI tắt; không đo tiết kiệm token.
- Cache chỉ trong phiên, không snapshot catalog. Dữ liệu thay đổi giữa trang vẫn có thể lặp/sót.
- Không sửa .env hoặc dữ liệu ngoài máy; chưa tích hợp Sapo POS/LLM.
- Kết quả live và review được lưu riêng khi hoàn tất.
