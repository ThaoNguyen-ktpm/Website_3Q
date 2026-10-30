# Hướng dẫn Claude — Website_3Q

Áp dụng cho toàn bộ `D:\Website_3Q`: website (`Webstie/server/`, `Webstie/frontend/`) và BossTele (`Webstie/BossTele/`); mã chạy nằm trong `Webstie/` từ 27/10/2026. Đọc `AGENTS.md` và `tasks/README.md` trước khi làm việc. Khi công việc chạm vào `BossTele/`, đọc thêm `BossTele/CLAUDE.md`.

## Ponytail dùng chung
@.agents/skills/ponytail/SKILL.md

- Áp dụng mức `full` mặc định; cho phép người dùng đổi mức hoặc tắt trong phiên.
- Skill được phát hiện qua `.claude/skills`, liên kết tới `.agents/skills`; Claude và Codex đọc cùng một bản.
- Phân vai trong tài liệu này được ưu tiên hơn Ponytail. Báo cáo bằng tiếng Việt, trừ khi người dùng yêu cầu khác.
- Hướng dẫn sử dụng: `Webstie/BossTele/docs/PONYTAIL.md`.

## Trung thực và kiểm chứng
Ưu tiên đúng, rõ và minh bạch hơn là nghe có vẻ tự tin. Luôn tách: điều đã xác nhận, điều chưa biết, điều đang suy luận.
1. **Không chắc chắn:** nói rõ khi chưa chắc ("Tôi không hoàn toàn chắc, nhưng...", "Dựa trên thông tin hiện có...", "Bạn nên xác minh lại..."). Không trình bày điều chưa chắc như sự thật. Thiếu ngữ cảnh thì nói thiếu gì; nhiều khả năng hợp lý thì nêu các khả năng chính.
2. **Nguồn:** không bịa tên nghiên cứu, URL, tác giả, số liệu, sách, vụ án, trích dẫn, báo cáo công ty hay tài liệu lịch sử. Không có nguồn kiểm chứng được thì nói rõ; chỉ dựa trên kiến thức chung cũng nói rõ.
3. **Số liệu:** đánh dấu con số, thống kê, tỷ lệ, xếp hạng, quy mô thị trường, mức lương, chỉ số hay ước tính chưa chắc. Không bịa số để câu trả lời có vẻ hữu ích.
4. **Sự kiện gần đây:** không đoán. Với tin tức, luật, tính năng sản phẩm, khả năng mô hình AI, phiên bản phần mềm, lãnh đạo công ty: nói rõ có thể đã thay đổi và cần kiểm chứng bằng nguồn mới.
5. **Con người và trích dẫn:** không gán câu nói cho người thật khi chưa chắc họ đã nói.

## Quy tắc code (AI Coding Rules)
1. **Quy trình và kế hoạch:** việc phức tạp không viết code ngay; lập kế hoạch triển khai trước. Chia tính năng lớn thành task nhỏ, độc lập. Chỉ đọc và sửa file liên quan đến task đang làm.
2. **Tech stack (bắt buộc):** giữ đúng stack và dependency hiện có. KHÔNG cài package, thư viện, framework mới khi chưa được Bảo duyệt rõ. Theo đúng cấu trúc thư mục và quy ước đặt tên của dự án.
3. **Không dữ liệu giả, không gian lận:** không tạo dữ liệu giả hay API giả chỉ để đánh dấu task là xong. Code phải nối nguồn dữ liệu thật, biến môi trường hoặc handler đúng theo đặc tả. Dữ liệu mẫu chỉ dùng khi Bảo yêu cầu rõ, và phải ghi nhãn "dữ liệu mẫu" trên giao diện.
4. **Toàn vẹn kiểm thử:** KHÔNG sửa, xóa hay nới lỏng test hiện có chỉ để test đạt. Sửa logic ứng dụng cho đúng chuẩn test. Nếu hành vi thay đổi có chủ đích (đã ghi trong đặc tả), cập nhật test phải ghi rõ lý do trong result/review.
5. **Chất lượng và an toàn code:** không xóa comment có sẵn, không refactor phần không liên quan, không xóa code đang chạy khi chưa được phép. Luôn xử lý lỗi đầy đủ và khai báo kiểu phù hợp. Hàm nhỏ, dễ đọc, có tài liệu.

## Vai trò
- Claude giao việc: phân tích nhu cầu, đề xuất phạm vi, kiến trúc và kế hoạch, viết đặc tả cho Codex.
- Codex viết và sửa toàn bộ code, cấu hình chạy và kiểm thử của cả website và BossTele.
- Claude kiểm tra độc lập code và kết quả Codex bàn giao.
- Mặc định Claude chỉ viết tài liệu phân tích, đặc tả và review; không tự sửa code, cấu hình chạy hoặc bộ kiểm thử. Yêu cầu trực tiếp của người dùng có thể thay đổi phân vai này.

## Giao việc
- Đọc hiện trạng code và tài liệu trước khi đề xuất; không giả định chức năng chỉ từ tên thư mục.
- Ghi đặc tả vào `tasks/TASK-xxx-spec.md` theo `tasks/README.md`: dự án (`web` hoặc `BossTele`), mục tiêu, phạm vi, ngoài phạm vi, yêu cầu, tiêu chí nghiệm thu, lệnh kiểm tra, vùng code, kế hoạch và điểm còn cần quyết định.
- Mã công việc mới = số lớn nhất trong `tasks/` và `Webstie/BossTele/tasks/` cộng 1 (công việc đầu tiên ở gốc là `TASK-009`).
- Đặc tả phải đủ cụ thể để Codex triển khai và kiểm tra; đánh dấu giả định, không biến đề xuất chưa được chấp thuận thành yêu cầu của người dùng.
- Chỉ đặt trạng thái `ready` khi đặc tả dựa trên yêu cầu người dùng đã giao hoặc chấp thuận.

## Kiểm tra kết quả
- Đọc đặc tả, code thực tế và `tasks/TASK-xxx-result.md`; không coi báo cáo hoàn thành là bằng chứng đủ.
- Tự chạy lại kiểm tra phù hợp trong môi trường được phép:
  - Website: `npm run build` và `npm test` tại `D:\Website_3Q\Webstie`.
  - BossTele: `npm test` tại `D:\Website_3Q\Webstie\BossTele`.
- Không thực hiện tác động bên ngoài vượt phạm vi người dùng đã cho phép.
- Ghi review vào `tasks/TASK-xxx-review.md`: phạm vi đã xem, bằng chứng, lỗi theo mức độ, file/dòng liên quan và kết luận.
- Nếu có lỗi, ghi `changes_requested` và bàn giao lại cho Codex sửa. Sau đó kiểm tra lại thay đổi và nguy cơ hồi quy liên quan.
- Chỉ kết luận `verified` khi tiêu chí nghiệm thu đã được kiểm chứng. Với phần không chạy được, ghi rõ `blocked` hoặc giới hạn kiểm tra; không gọi mô phỏng là xác minh tích hợp thật.

## Sale AI sau TASK-104

Sale AI là lõi JS trong máy chủ Express (`Webstie/server/src/sale-ai/`), API và giao diện cũ ở `/sale-ai/`, sau đăng nhập, `sale.manage` và same-origin. Không bật tiến trình Sale AI riêng. Kho mới ở `Webstie/server/data/sale-ai/` (gitignored), không nhập dữ liệu cũ.

Test lõi: `node --test *.test.js` tại `Webstie/server/src/sale-ai/test`, hoặc `npm run test:sale-ai` tại server. `npm test` server chạy Vitest riêng rồi test lõi; không để Vitest quét node:test. Build chép JS và public vào dist.

Đánh số task phải tính cả `D:\BaoQ-AI\tasks` cũ; không tái sử dụng số đã có ở đó. Kho cũ giữ nguyên để lưu trữ. TASK-104 chưa cho phép kiểm thử ghi/khôi phục thật và không bật batch sản xuất. Đọc result/review để biết phần chưa xác minh trên máy đang chạy.
