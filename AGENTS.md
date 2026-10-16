# Hướng dẫn Codex — Website_3Q

Áp dụng cho toàn bộ `D:\Website_3Q`: website (`server/`, `client/`) và BossTele (`BossTele/`). Khi làm trong `BossTele/`, đọc thêm `BossTele/AGENTS.md`.

## Ponytail dùng chung
- Khi làm công việc code, đọc `.agents/skills/ponytail/SKILL.md` và áp dụng mức `full` mặc định, trừ khi người dùng chọn mức khác hoặc tắt trong phiên.
- Các skill review/audit chỉ đọc và báo cáo; không tự sửa code khi người dùng chỉ yêu cầu kiểm tra.
- Ponytail bổ sung cách làm gọn, không thay đổi phân vai bên dưới. Trả lời và viết báo cáo bằng tiếng Việt, trừ khi người dùng yêu cầu khác.
- Hướng dẫn cài và gọi skill: `BossTele/docs/PONYTAIL.md`.

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

## Bản đồ repo
Chỉ ghi cấp thư mục. Khi thêm, xóa hoặc đổi vai trò một thư mục dưới đây, cập nhật mục này trong cùng thay đổi.

- `server/`: API Express + Prisma (TypeScript), test bằng Vitest + supertest.
  - `src/routes/` → `src/controllers/` → `src/services/` → `src/models/` (truy cập Prisma).
  - `src/middlewares/`: xác thực, phân quyền, giới hạn tần suất, kiểm tra cùng nguồn, xử lý lỗi.
  - `src/config/`: biến môi trường, quyền, cookie phiên, admin chính.
  - `src/tests/`: test API. `prisma/`: schema, migrations, seed.
- `client/`: React + Vite + Tailwind (TypeScript).
  - `src/pages/`: các trang; `src/admin/`: khu quản trị (models, controllers, views, components).
  - `src/api/`: gọi API server; `src/hooks/`, `src/components/`: dùng chung.
  - `src/three/`: mô hình 3D túi Birkin (three.js).
- `BossTele/`: công cụ Node >= 22 riêng (tìm sản phẩm, chat, định giá, bộ lọc Telegram). `lib/` logic, `test/` test, `docs/` tài liệu. `vendor/` là submodule, không sửa.
- `tasks/`: spec, result, review từ `TASK-009`. `BossTele/tasks/`: lưu trữ `TASK-001` đến `TASK-008`.
- `PRODUCT.md`, `DESIGN.md`: mô tả sản phẩm và hệ thống thiết kế giao diện.
- `.agents/skills/` (cũng là `.claude/skills/`): skill cho agent, không phải code dự án; đã loại khỏi index CodeGraph qua `codegraph.json`.

Tra cứu chi tiết bằng CodeGraph (luôn theo code hiện tại, không cần cập nhật tay):
- Cây file: `codegraph files --filter server/src --max-depth 3`
- Nơi gọi một hàm: `codegraph callers <symbol>`; phạm vi ảnh hưởng khi sửa: `codegraph impact <symbol>`
- Test liên quan file đã sửa: `codegraph affected <file...>`

## Nguyên tắc triển khai
- Giữ thay đổi trong phạm vi yêu cầu, bảo toàn công việc có sẵn của người dùng.
- Không tự chọn công nghệ hoặc tính năng lớn khi yêu cầu dự án chưa được xác định.
- Không ghi bí mật, token hoặc mật khẩu vào code, tài liệu hay log.
- Website chỉ dùng dữ liệu thử; không kết nối KiotViet, Sapo, cổng thanh toán hoặc dịch vụ thật. Ngoại lệ đã được Bảo duyệt (TASK-010): Google Sign-In để đăng nhập.
- Ưu tiên dữ liệu thử nghiệm cho kiểm tra; thao tác tài khoản thật, gửi tin, triển khai hoặc thay đổi dữ liệu ngoài máy cần nằm trong phạm vi người dùng đã cho phép.
- Báo cáo trung thực: phân biệt kiểm tra cục bộ, mô phỏng và hành vi đã xác minh trên hệ thống thật.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
