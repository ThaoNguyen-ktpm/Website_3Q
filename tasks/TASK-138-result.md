Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-138 — Kết quả triển khai

- Dự án: web (Sale AI)
- Người phụ trách: Codex
- Trạng thái: `ready_for_review` (chưa được Claude kiểm tra độc lập)
- Đặc tả: `tasks/TASK-138-spec.md`; nền TASK-137 đã `verified` theo phần kiểm tra lại trong review.

## Kế hoạch triển khai

- [x] Cập nhật test lịch/API và giao diện không còn lớp chặn máy; chạy để xác nhận lỗi trước khi sửa.
- [x] Bỏ `SALE_AI_AUTO_UPDATE`, `autoUpdateAllowed`, `allowed` trong runtime/core/lịch và giao diện; giữ mặc định Tắt, 10:00, các khóa đang chạy/bận và toàn bộ quy tắc TASK-137.
- [x] Bỏ nhãn Laptop cố định, thêm câu xác nhận chỉ bật một máy, cập nhật AUTO-UPDATE.md.
- [x] Chạy test liên quan và thử toàn bộ lõi với `node --test --test-isolation=none`; thử build/test chung, ghi đúng kết quả và giới hạn bên dưới.

Không đọc/sửa `.env`, không gọi Kiot/Sapo thật, không bật lịch thật, không điều khiển server, không commit. Các lần bật/tắt trong test chỉ dùng kho nhớ và client giả lập hiện có.

## Thay đổi và file liên quan

- `Webstie/server/src/sale-ai/runtime.ts`: ngừng đọc biến `SALE_AI_AUTO_UPDATE` và truyền tùy chọn chặn máy; giữ vòng kiểm tra lịch mỗi 15 giây của TASK-137.
- `Webstie/server/src/sale-ai/core.js`: bỏ tham số `autoUpdateAllowed`, khởi tạo `AutoUpdate` chỉ bằng kho và đồng hồ hiện có.
- `Webstie/server/src/sale-ai/lib/auto-update.js`: bỏ thuộc tính `allowed`, nhánh trả 403 theo máy và trường API `allowed`. Lịch dựa vào công tắc lưu trong kho; giữ điều kiện ngày/giờ, cửa sổ 5 phút, chống lặp, khóa khi chạy và kiểm tra dữ liệu API.
- `Webstie/server/src/sale-ai/public/live-ui.js`: bỏ khóa và thông báo “chỉ Laptop”, bỏ nhãn máy cố định (không thêm nhãn máy mới). Giữ khóa khi đang chạy/đang lưu/bận. Khung xác nhận Bật thêm đúng câu “Chỉ bật trên một máy để tránh ghi Kiot hai lần.”
- `Webstie/server/src/sale-ai/test/auto-update.test.js`: bỏ tùy chọn fixture chặn máy và các assertion dành riêng cho 403/không chạy theo máy, đúng yêu cầu đổi hành vi. Các test lịch khác giữ assertion; thêm kiểm tra POST giờ tùy chọn trả 200.
- `Webstie/server/src/sale-ai/test/auto-update-ui.test.js`: bỏ trường `allowed` khỏi fixture, bỏ trường hợp khóa vì máy; giữ kiểm tra khóa khi có lượt chạy. Kiểm tra công tắc/Đổi giờ khả dụng khi API không có trường quyền máy, câu xác nhận mới, hủy không ghi và hiển thị ngay phản hồi POST của TASK-137.
- `Webstie/server/src/sale-ai/AUTO-UPDATE.md`: hướng dẫn bật trên trang, không cần sửa `.env`, chỉ bật một máy; giữ hướng dẫn vận hành/an toàn còn lại.
- `tasks/TASK-138-result.md`: báo cáo này.

Working tree đã có thay đổi TASK-137 trước khi bắt đầu. Không hoàn tác, commit hay sửa các file TASK-137 ngoài các dòng cần cho TASK-138 ở trên; giữ phần `verified` của review TASK-137.

## Bằng chứng kiểm tra

Các lệnh dưới đây chạy ngày 04/11/2026 trên máy ghi ở đầu báo cáo.

- TDD trước sửa code: sau khi bỏ quyền máy khỏi fixture, test API hợp lệ còn trả **403 thay vì 200**, lịch không ghi theo kỳ vọng; test UI thất bại vì còn khóa máy và thiếu câu xác nhận mới. Lượt test UI riêng đã xác nhận **5 lỗi assertion** trước triển khai. Một lượt soạn test ban đầu lỗi regex do truyền Unicode qua pipe PowerShell/Python; đã sửa nội dung test bằng patch UTF-8 trước khi xác nhận lỗi hành vi. Không nới assertion để đạt.
- Tại `Webstie/server/src/sale-ai/test`: `node --test --test-isolation=none auto-update.test.js auto-update-ui.test.js hidden-before-july.test.js kiot-batch-runtime.test.js sapo-rate-limit.test.js` → **46/46 đạt**, không bỏ qua, exit 0. Bao gồm Chủ nhật, mặc định Tắt/10:00, cửa sổ 5 phút, M0, giữ giá sửa tay, ngưỡng 2.000, API cài đặt và ba file từng lỗi trong review TASK-137.
- Cùng thư mục: `node --test --test-isolation=none *.test.js` → **đã chạy nhưng chủ động ngắt bằng Ctrl+C, exit 1, không có tổng kết suite**. Các test in ra trước khi ngắt đều đạt, gồm test nền 1.500 sản phẩm (~116,4 giây) và các test batch trước trường hợp 5.000 sản phẩm. Đây là lượt chưa hoàn tất, không tính là toàn bộ lõi đạt. Chỉ dừng tiến trình test vừa tạo; không dừng/restart server, không thay test hay tăng timeout để đạt.
- Tại `Webstie`: `npm.cmd run build` → server `tsc` và chép tài nguyên đạt; frontend `tsc --noEmit` đạt; **Vite bị sandbox chặn `spawn EPERM` khi nạp config bằng esbuild**, exit 1. Chưa có bằng chứng build toàn bộ đạt.
- Tại `Webstie`: `npm.cmd test` → **bị chặn `spawn EPERM` ở runner node:test của shared**, 7 file không khởi chạy; chuỗi dừng trước frontend/server, exit 1.
- Tại `Webstie/frontend`: `npm.cmd test` → Playwright liệt kê 6 test, **không tạo được worker (`spawn EPERM`)**, exit 1; không có test frontend đạt từ lệnh này.
- Tại `Webstie/server`: `npx.cmd vitest run src/tests/saleAiRuntime.test.ts src/tests/saleAiProxy.test.ts src/tests/saleAiUpdateAll.test.ts` → **bị chặn `spawn EPERM` khi esbuild nạp config**, exit 1; nhóm runtime/proxy/E2E chưa chạy được.
- `node --check` cho `core.js`, `lib/auto-update.js`, `public/live-ui.js`, `test/auto-update.test.js`, `test/auto-update-ui.test.js` → đạt.
- `git diff --check` → đạt; Git chỉ cảnh báo chuyển LF/CRLF trên một số file có sẵn trong working tree.

## Giới hạn và bước tiếp theo

- Chưa xác minh giao diện bằng trình duyệt/Admin 8787 và chưa chạy lịch thật. Test UI ở đây là renderer trong VM với DOM giả lập, không phải nghiệm thu trình duyệt.
- E2E 5 lần, build/test đầy đủ và BossTele `npm test` theo đặc tả thuộc lượt nghiệm thu Claude. BossTele không bị sửa và chưa chạy trong phiên này; E2E đang bị chặn ngay từ khởi tạo Vitest.
- Claude kiểm tra độc lập TASK-138, đặc biệt điều khiển Bật/Tắt/Đổi giờ trên máy không có biến môi trường, rồi cập nhật review. Chưa ghi `verified` cho TASK-138.
- Các máy vẫn có kho độc lập: người vận hành chỉ bật trên một máy để tránh ghi trùng; TASK-138 không thêm cơ chế khóa liên máy.
