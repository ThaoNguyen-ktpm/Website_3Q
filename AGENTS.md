# Hướng dẫn Codex — Website_3Q

Áp dụng cho toàn bộ `D:\Website_3Q`: website (`server/`, `client/`) và BossTele (`BossTele/`). Khi làm trong `BossTele/`, đọc thêm `BossTele/AGENTS.md`.

## Ponytail dùng chung
- Khi làm công việc code, đọc `.agents/skills/ponytail/SKILL.md` và áp dụng mức `full` mặc định, trừ khi người dùng chọn mức khác hoặc tắt trong phiên.
- Các skill review/audit chỉ đọc và báo cáo; không tự sửa code khi người dùng chỉ yêu cầu kiểm tra.
- Ponytail bổ sung cách làm gọn, không thay đổi phân vai bên dưới. Trả lời và viết báo cáo bằng tiếng Việt, trừ khi người dùng yêu cầu khác.
- Hướng dẫn cài và gọi skill: `BossTele/docs/PONYTAIL.md`.

## Phân vai
- Codex phụ trách toàn bộ việc triển khai: tạo và sửa code, cấu hình kỹ thuật, viết kiểm thử, sửa lỗi và chạy các kiểm tra phù hợp.
- Claude giao việc bằng đặc tả và kiểm tra độc lập kết quả của Codex.
- Yêu cầu trực tiếp và mới nhất của người dùng được ưu tiên hơn các tài liệu bàn giao.

## Quy trình làm việc
- Đọc `tasks/README.md`, đặc tả `tasks/TASK-xxx-spec.md` và review Claude liên quan trước khi triển khai.
- Với công việc đã được người dùng giao rõ, chủ động thực hiện đến khi hoàn tất; không đợi Claude nếu không có yêu cầu phải chờ review trước.
- Nếu đặc tả còn thiếu, đọc code và tài liệu hiện có, ghi rõ giả định; hỏi khi thiếu thông tin ảnh hưởng đáng kể đến phạm vi hoặc kết quả.
- Codex sở hữu thay đổi code và kiểm thử. Nhận lỗi từ Claude, kiểm chứng, sửa và cập nhật bằng chứng.
- Ghi kết quả vào `tasks/TASK-xxx-result.md`: thay đổi, file liên quan, lệnh kiểm tra, kết quả thực tế và giới hạn chưa xác minh.
- Dùng trạng thái `ready_for_review` khi bàn giao cho Claude; chỉ ghi `verified` khi có kết quả kiểm tra độc lập. Nếu chưa review, nói rõ code đã hoàn tất nhưng chưa được Claude kiểm tra.

## Kiểm tra
- Website: `npm run build` và `npm test` tại `D:\Website_3Q`.
- BossTele: `npm test` tại `D:\Website_3Q\BossTele`.

## Nguyên tắc triển khai
- Giữ thay đổi trong phạm vi yêu cầu, bảo toàn công việc có sẵn của người dùng.
- Không tự chọn công nghệ hoặc tính năng lớn khi yêu cầu dự án chưa được xác định.
- Không ghi bí mật, token hoặc mật khẩu vào code, tài liệu hay log.
- Website chỉ dùng dữ liệu thử; không kết nối KiotViet, Sapo, cổng thanh toán hoặc dịch vụ thật. Ngoại lệ đã được Bảo duyệt (TASK-010): Google Sign-In để đăng nhập.
- Ưu tiên dữ liệu thử nghiệm cho kiểm tra; thao tác tài khoản thật, gửi tin, triển khai hoặc thay đổi dữ liệu ngoài máy cần nằm trong phạm vi người dùng đã cho phép.
- Báo cáo trung thực: phân biệt kiểm tra cục bộ, mô phỏng và hành vi đã xác minh trên hệ thống thật.
