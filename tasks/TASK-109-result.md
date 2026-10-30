# TASK-109 — Kết quả triển khai

- Dự án: web — Sale AI trong `Webstie/server/src/sale-ai/`.
- Người thực hiện: Codex.
- Ngày: 30/10/2026.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai lọc bảng mới, thêm metadata số ẩn, kiểm tra bằng fixture qua `core.js` và ghi bằng chứng bên dưới.
- Bước tiếp theo: Claude review độc lập, chạy lại build/test trong môi trường cho phép spawn và kiểm trang Sale AI tại 8787. Chưa được Claude kiểm tra cho TASK-109; không đánh dấu `verified`.

## Thay đổi

- `Webstie/server/src/sale-ai/lib/pricing.js`: thêm `excludedReason: 'before_no_markdown'` tại nhánh ngày tạo trước `NO_MARKDOWN_BEFORE` có sẵn. Không so chuỗi lý do, không đổi POLICY, công thức hay thứ tự kiểm tra TASK-105.
- `Webstie/server/src/sale-ai/lib/service.js`: khi tạo run mới, bỏ những dòng có mã lý do trên, lưu `hiddenBeforeNoMarkdownCount` cùng run. Lọc sau bước ghép snapshot để không lệch ID/ghi chú giữa sản phẩm và dòng kết quả. Không xóa hồ sơ sản phẩm/P0 hoặc sửa bảng cũ.
- `Webstie/server/src/sale-ai/lib/view-data.js`: đưa số ẩn qua danh sách trường metadata run cho API xem bảng/lịch sử.
- `Webstie/server/src/sale-ai/public/app.js`: bên cạnh tổng số món trong phân trang kết quả, hiện “Đã ẩn 2.886 món tạo trước 01/07/2026 (không giảm)” với số thực tế của run và định dạng `vi-VN`. Bảng cũ không có metadata hoặc số ẩn bằng 0 không hiện thông báo. Dùng chung cho bảng mẫu và bảng thật.
- `Webstie/server/src/sale-ai/test/hidden-before-july.test.js`: sáu test mới. Bốn test đi qua handler/core với ba store bộ nhớ và client fixture, một test core bổ sung chọn tất cả qua hai trang, một test chạy hàm phân trang giao diện trong VM.
- `Webstie/server/src/sale-ai/test/jul-batch.test.js`: cập nhật test cũ vì TASK-109 chủ đích đổi kỳ vọng từ “có dòng excluded” sang “không có dòng”. Vẫn kiểm tra từ chối prepare; thêm kiểm tra giữ sản phẩm, số ẩn và từ chối mã ẩn trong `excludedCodes`. Các test quy tắc giá giữ nguyên.
- `tasks/TASK-109-plan.md`: kế hoạch và giới hạn triển khai.

Tìm kiếm, bộ lọc M, phân trang, chọn tất cả dùng `run.rows` còn lại qua các handler hiện có; không cần đổi logic ghi giá/rollback/kiểm chứng. Không sửa `BossTele/sale-price.js`, phần tự đọc Sapo TASK-108 hoặc dữ liệu kho đang chạy. Các loại trừ khác và các trường hợp chờ do validation vẫn theo thứ tự xử lý cũ của `calculate()`.

## Bằng chứng kiểm tra mới

1. Trước sửa logic: `node --test Webstie/server/src/sale-ai/test/hidden-before-july.test.js` tại gốc repo bị `Error: spawn EPERM` (exit 1), chưa chạy nội dung test. Không xin quyền.
2. Trước sửa logic: thêm `--test-isolation=none` để chạy cùng tiến trình. Năm test ban đầu thất bại đúng ở hành vi thiếu: dòng trước tháng 7 còn trong run, thiếu số ẩn, chọn tất cả còn trả mã ẩn và UI chưa có tóm tắt. Sau triển khai, nhóm test này cùng `jul-batch.test.js` đạt 24/24.
3. Sau bổ sung test chọn tất cả qua hai trang, lệnh cuối tại gốc repo:

   `node --test --test-isolation=none Webstie/server/src/sale-ai/test/hidden-before-july.test.js Webstie/server/src/sale-ai/test/jul-batch.test.js`

   Exit 0, **25 test đạt, 0 lỗi, 0 skip**. Riêng file TASK-109 đạt 6/6.
4. Tại `Webstie/server/src/sale-ai/test/`: `node --test --test-isolation=none *.test.js` kết thúc exit 0, **211 test đạt, 0 lỗi, 0 skip**, khoảng 72,7 giây. Bài hiệu năng 5.000 sản phẩm cũng đạt; toàn bộ thao tác nền tảng trong các bài đó dùng fixture. Đây là kết quả chế độ không cô lập, không thay thế bằng chứng chạy chế độ mặc định của Claude. Lệnh được khởi chạy trước khi thêm test chọn tất cả qua hai trang; test bổ sung đã được kiểm tra riêng trong lần chạy cuối 25/25 ở trên, không đổi code ứng dụng sau lần chạy toàn bộ.
5. `npm.cmd run build` tại `Webstie`: exit 1. Server `tsc -p tsconfig.json && node scripts/copy-sale-ai.mjs` đạt; client qua `tsc -b`, bị chặn tại `vite build` khi esbuild spawn (`EPERM`). Không kết luận toàn bộ build đạt.
6. `npm.cmd test` tại `Webstie`: exit 1 tại khởi động Vitest/esbuild (`spawn EPERM` khi tải `server/vitest.config.ts`). Vitest chưa chạy, script chưa tới nhánh test lõi mặc định.
7. `node --check` lần lượt cho `lib/pricing.js`, `lib/service.js`, `lib/view-data.js`, `public/app.js`: không báo lỗi cú pháp. `git diff --check` đạt với cảnh báo đổi LF/CRLF trên một số file có thay đổi sẵn; lệnh Git không kiểm tra nội dung thư mục Sale AI đang untracked.

Các fixture TASK-109 xác nhận:

- Ngày tạo 15/03 và 30/06 bị ẩn, 01/07 và 20/10 còn lại: 4 hồ sơ, 2 dòng trong run, số ẩn 2; P0 được giữ.
- Mã lý do có cấu trúc; biên UTC 30/06 lúc 16:59:59Z bị ẩn, lúc 17:00:00Z là ngày 01/07 Việt Nam và còn trong bảng.
- Hết tồn/ngừng kinh doanh tạo sau mốc vẫn giữ dòng excluded như cũ; ID và ghi chú snapshot đúng từng dòng.
- Số dòng/số ẩn được lưu, đọc lại sau tạo core mới; bảng cũ giữ nguyên nội dung.
- Tổng số, lọc M, tìm kiếm mã ẩn, clamp trang, chọn tất cả trên 13 món qua hai trang chỉ dùng dòng còn lại.
- Prepare mã ẩn trả 400 do không đủ điều kiện và không gọi client; số lệnh client trong fixture TASK-109 bằng 0.
- Bảng toàn món ẩn còn 0 dòng, số ẩn đúng; bảng không có món ẩn còn đủ dòng và số ẩn 0.
- UI định dạng số 2.886, hiển thị thông báo cạnh tổng số; bảng cũ thiếu metadata vẫn render bình thường. Đây là kiểm tra hàm render trong VM, chưa phải kiểm chứng trình duyệt.

## Giới hạn và phần để sau

- Mục 4 của đặc tả cho phép để sau: chưa hiện câu riêng “MÃ tạo trước 01/07/2026: không giảm, không hiện trong bảng” khi tìm đúng mã bị ẩn. Tìm mã đó trả 0 dòng và UI hiện trạng thái không có sản phẩm khớp từ khóa/bộ lọc. Không lưu thêm danh sách mã bị ẩn vào mỗi run.
- Không đăng nhập hoặc kiểm giao diện thật tại 8787; không xác minh số 2.886 trên kho thật. Số này trong kiểm tra UI chỉ là fixture để kiểm định dạng; thông báo thực tế dùng metadata run.
- Không gọi Kiot/Sapo thật, không in/đọc khóa, không bật batch sản xuất, không thử ghi hoặc khôi phục thật, không dừng/khởi động lại server. Không commit, không revert thay đổi sẵn có.
- Bảng đã lưu không được di trú; phải tạo run mới bằng “Kiểm thử” theo đặc tả để có danh sách và số ẩn mới.

## Bổ sung POLICY — 30/10/2026

- `ready_for_review`: đổi duy nhất POLICY trong `Webstie/server/src/sale-ai/lib/pricing.js` từ `baoq-2026-10-29-jul-batch-v9` sang `baoq-2026-10-30-hide-before-jul-v10`; cập nhật đúng chuỗi kỳ vọng trong `fifteen-days.test.js`, `preoct-m1.test.js`, `note-first.test.js`. Đây là thay đổi phiên bản có chủ đích theo phần Bổ sung; không đổi logic giá. Ghi chú này thay thế hướng dẫn cũ bên trên về việc phải bấm “Kiểm thử”: POLICY mới cho phép `/api/table/ensure` tạo lại bảng.
- Kiểm tra: trước khi đổi POLICY, 3 test kỳ vọng mới thất bại đúng do còn chuỗi cũ. Sau sửa, `node --test --test-isolation=none Webstie/server/src/sale-ai/test/fifteen-days.test.js Webstie/server/src/sale-ai/test/preoct-m1.test.js Webstie/server/src/sale-ai/test/note-first.test.js Webstie/server/src/sale-ai/test/hidden-before-july.test.js` tại gốc repo đạt **23/23**, exit 0.
- `npm.cmd test` tại `Webstie` bị sandbox chặn `spawn EPERM` lúc tải cấu hình Vitest/esbuild (exit 1, chưa chạy test). `npm.cmd run build` tại đó: server build và client TypeScript đạt, Vite/esbuild bị `spawn EPERM` (exit 1). Không xin quyền.
- Chưa kiểm tra bảng thật hoặc được Claude review độc lập cho bổ sung này. Không gọi Kiot/Sapo thật, không khởi động lại server, không commit; giữ nguyên thay đổi sẵn có.
- Bổ sung BossTele (30/10/2026, ready_for_review): cập nhật duy nhất chuỗi POLICY kỳ vọng trong `Webstie/BossTele/test/sale-price.test.js` thành `baoq-2026-10-30-hide-before-jul-v10`; `node --test --test-isolation=none test/sale-price.test.js` tại `Webstie/BossTele` đạt 6/6, exit 0; chưa chạy lại toàn bộ suite, chưa review độc lập, không commit.
