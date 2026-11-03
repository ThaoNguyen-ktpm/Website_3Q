Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-114 — Một chỗ xem chi tiết toàn bộ lượt Sale AI

- Dự án: web / Sale AI. Người thực hiện: Codex.
- Thực hiện sau TASK-115, trong cùng lượt theo chỉ thị trực tiếp của Bảo.
- Trạng thái: `ready_for_review`; chưa có kiểm tra độc lập của Claude.
- Hành động gần nhất: triển khai tổng hợp, API và hộp chi tiết ba bộ lọc; chạy kiểm tra hồi quy.
- Bước tiếp theo: Claude chạy E2E, build/test website và kiểm tra Lịch sử 8787 trong môi trường cho phép tạo tiến trình con.

## Thay đổi

- `lib/update-report.js`: thêm `updateReport(update)` để tổng hợp toàn lượt, đếm thành công, lỗi kiểm tra, lỗi khi ghi, chưa xác minh, chưa gửi và đã đúng giá. `reportRows` hợp nhất theo mã, không đếm trùng; `reportStatus` phân loại hiển thị theo kết quả từng bên, không sửa trạng thái engine. Giữ `updateSummary(items)` và `issueCount` cho code ghi/nhật ký hiện có.
- `summaryText` dùng tổng mới, định dạng số Việt Nam, bỏ nhóm bằng 0; áp cho cập nhật và khôi phục. Ví dụ kiểm chứng: **0/1.314 thành công · 64 lỗi kiểm tra · 1.250 chưa gửi**. `failureReason` giữ nguyên lỗi đã lưu, bổ sung lỗi từng nền tảng khi thiếu lỗi tổng.
- `lib/view-data.js`: lịch sử và API chi tiết đều tính từ dữ liệu có sẵn; không tin summary/issueCount cũ để hiển thị tổng. API thêm `filter=all|success|issues`, giữ `errorsOnly=true` tương thích. Phân trang và lịch sử từng lần thử giữ nguyên; response giới hạn trường công khai như trước.
- `public/live-ui.js`: mỗi dòng lịch sử có một nút **Xem chi tiết (N món)**; giữ nguyên nút Khôi phục. Hộp chi tiết có ba bộ lọc Tất cả / Thành công / Lỗi + chưa gửi kèm số. Có lỗi thì mở sẵn bộ lọc lỗi; đổi lọc về trang 1, hủy request chi tiết cũ, giữ focus. Retry-selection và hành vi cập nhật lại giữ nguyên, thanh retry chỉ hiển thị ở bộ lọc lỗi. Mỗi dòng có trạng thái tiếng Việt, lý do và kết quả Kiot/Sapo riêng.
- `public/style.css`: hai quy tắc dùng token hiện có cho bộ lọc, có trạng thái `aria-pressed`, xuống dòng khi hẹp. Không thay hệ thống thiết kế.
- `lib/live.js`: chỉ bổ sung hai dòng metadata `unchangedCodes` từ danh sách đã tính sẵn ở prepare và copy vào lượt mới. Không đổi cách chọn, kiểm tra, ghi, rollback hoặc giới hạn Sapo. Lượt cũ chỉ có số unchanged vẫn tính vào tổng, giao diện nói rõ không lưu danh sách mã; không tự tạo mã hay sửa kho cũ.
- Trường hợp khôi phục cũ: các dòng cả hai bên đều `skipped` nhưng trạng thái tổng engine là `done` được hiển thị **Chưa gửi**, kèm lý do gốc; không nhận nhầm thành công. Giữ nguyên engine rollback. Aggregate `write_failed` nhưng mọi bên đều `not_sent` cũng được phân loại Chưa gửi.

## Kiểm thử và thay đổi assertion

- Thêm `test/update-report.test.js`: sáu ca cho tổng 64+1.250, nhóm trạng thái, trùng mã, unchanged kiểu danh sách/kiểu số, lượt khôi phục, skipped hai bên và aggregate not_sent. Các ca mới đã thất bại trước sửa đúng hành vi thiếu/đếm sai.
- Thêm `test/history-details.test.js`: hai ca chạy code UI thật trong VM với DOM boundary tối thiểu, API dùng `updateDetail` thật. Kiểm tra HTML một nút, ba bộ lọc/số đếm, mở đúng lọc, chuyển lọc/request/trang, retry đúng chỗ, escaping dữ liệu, đóng hộp. Đây là test HTML và event handler, **không phải test trình duyệt**.
- `batch-joint.test.js`, `batch-update.test.js`, `journal-window.test.js`, `restore-joint.test.js`: đổi assertion câu tóm tắt cũ theo TASK-114, giữ assertion logic ghi và rollback; thêm kiểm tra lưu unchangedCodes. Không nới lỏng test hoặc sửa timeout.
- E2E `saleAiUpdateAll.test.ts`: chỉ thay ca 12 theo TASK-115, kiểm tra mã hàng cao giá không có trong bảng, selection/excludedCodes và không gửi cả Kiot/Sapo. Bảo toàn các thay đổi E2E TASK-112/113 đã có trước phiên.

## Bằng chứng đã chạy

Tại `Webstie/server`:

- `node --test --test-isolation=none src/sale-ai/test/history-details.test.js src/sale-ai/test/update-report.test.js`: **8/8 đạt**, không skip trên bản cuối của hai file này.
- Lượt focused hồi quy với `--test-skip-pattern='5.000 products'` cho batch-joint, batch-update, journal-window, restore-joint, update-report, history-details, view-performance: **64/64 đạt** trước khi bổ sung ca aggregate not_sent cuối. Ca 5.000 món được loại khỏi lượt focused này, không dùng lượt này làm bằng chứng suite đầy đủ.
- `node --check` cho `public/live-ui.js`, `public/app.js`, `lib/view-data.js`, `lib/update-report.js`, `lib/live.js`, `lib/pricing.js`, `lib/service.js`: đạt.
- E2E `$env:SALE_AI_E2E='1'; ..\node_modules\.bin\vitest.cmd run src/tests/saleAiUpdateAll.test.ts`: sandbox chặn **spawn EPERM** khi esbuild tải `vitest.config.ts`; chưa chạy các ca, không xác nhận đạt.

Tại `Webstie`:

- `npm.cmd run build --workspace server`: **đạt**, gồm TypeScript và copy Sale AI.
- `npm.cmd run build`: server build và frontend TypeScript đạt; frontend Vite build bị sandbox chặn **spawn EPERM** ở esbuild.
- `npm.cmd test`: bị **spawn EPERM** khi Playwright tạo worker frontend; script dừng trước server Vitest/suite lõi.
- Một lần gọi nhầm `npm.cmd run build --workspace server` từ thư mục `Webstie/server` báo `No workspaces found`; đã chạy lại đúng tại `Webstie` và đạt. npm cũng không ghi được log vào cache ngoài workspace; không xin quyền.

Tại BossTele (liên quan TASK-115): `npm.cmd test` bị spawn EPERM ở 17 file; fallback `node --test --test-isolation=none test/*.test.js` chạy **140 ca, 111 đạt, 29 lỗi**, không skip. Cả 29 lỗi thuộc `test/add.test.js` do `spawnSync node.exe EPERM`; các ca sale-price **7/7 đạt**. Không sửa test CLI để né sandbox.

Impeccable detector chạy một lần: hai cảnh báo border-left trong CSS cũ (dòng 1 và 15), không thuộc hai quy tắc bộ lọc mới; giữ nguyên vì ngoài phạm vi. Chưa kiểm chứng ảnh chụp hoặc tương tác trình duyệt 8787.

## Giới hạn và an toàn

Không gọi Kiot/Sapo thật, không đọc `.env`, không in khóa, không dừng/restart server hoặc bot, không commit, không cài dependency. Dữ liệu kiểm thử nằm trong fixture/store tạm; không migration, xóa hay sửa lịch sử đã lưu của người dùng. Chưa đánh dấu `verified`; cần Claude kiểm tra độc lập.

## Kết quả cuối cùng và review

- `node --test --test-isolation=none src/sale-ai/test/*.test.js` tại `Webstie/server`: **218/218 đạt**, không fail/cancel/skip, exit 0, khoảng **182 giây**. Bao gồm test 5.000 món, hồi quy ghi/rollback và giới hạn Sapo TASK-113. Đây là kiểm tra fixture và lõi trong một tiến trình, không thay thế E2E website bị chặn.
- Reviewer chỉ đọc theo skill `requesting-code-review` không phát hiện lỗi cần sửa trong diff TASK-115/114. Reviewer đã tự chạy `node --test --test-isolation=none test/update-report.test.js test/history-details.test.js test/hidden-before-july.test.js` từ `sale-ai`: **15/15 đạt**. Không đánh giá phần TASK-112/113 có sẵn; chưa kiểm chứng browser thực. Đây chưa phải review của Claude, nên giữ `ready_for_review`.
- Sau bỏ dòng tổng phụ platformSummary, test focused report/history **8/8 đạt**. Tất cả tổng hiển thị dùng báo cáo chung; chi tiết từng nền tảng vẫn hiện trên từng dòng trong hộp.
- `git diff --check`: đạt. Hai log tạm của suite lõi và BossTele đã được đọc lấy kết quả rồi gỡ; bằng chứng lệnh, số ca và lỗi sandbox được giữ trong hai result này.
