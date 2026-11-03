Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-115 — Loại hàng P0 từ 600 triệu

- Dự án: web / Sale AI + BossTele. Người thực hiện: Codex.
- Trạng thái: `ready_for_review`; chưa có review độc lập của Claude.
- Hành động gần nhất: hoàn tất thay đổi chính sách và kiểm tra focused; tiếp tục TASK-114 theo thứ tự yêu cầu.
- Bước tiếp theo: Claude chạy lại E2E và kiểm tra giao diện 8787 sau khi nạp bản code mới bằng quy trình của người vận hành.

## Thay đổi

- `lib/pricing.js`: POLICY `baoq-2026-11-02-hide-600m-v11`; P0 nguyên hợp lệ ≥600 triệu trả `excluded`, `excludedReason:over_600m`, lý do “Giá gốc từ 600 triệu: không giảm”, không đề xuất giá/ghi chú. Áp dụng cả khi có manualPricing cũ, thiếu thông tin khác hoặc hết tồn; không sửa quy tắc M của hàng dưới ngưỡng.
- `lib/service.js`: đếm `hiddenOver600mCount`, lọc sau snapshot để giữ đúng danh tính. `lib/view-data.js` truyền số ẩn; `public/app.js` hiển thị “Đã ẩn N món từ 600 triệu (không giảm)”. Bảng mới và select-all không chứa mã này, prepare thủ công bị từ chối tại máy, không gửi API ngoài.
- Gỡ `Simulator.saveManual`, `lib/manual-pricing.js` và `test/manual.test.js` theo yêu cầu bỏ code chết. Trước gỡ, helper chỉ được pricing/service và test riêng sử dụng; tìm lại `manual-pricing|saveManual|percentageSuggestion|validateManual` trong code Webstie không còn caller. Giao diện hiện hành vốn đã không có đường nhập; endpoint `/api/manual-price` giữ trả 410. Test endpoint 410 và bảo toàn giá cũ được giữ lại bằng handler thật trong `hidden-before-july.test.js`.
- Giữ manualPricing/manualEdits cũ, snapshot lịch sử và fingerprint đang dùng dữ liệu cũ; không migration hoặc xóa kho.
- `BossTele/sale-price.js`: trả lý do “không giảm (giá gốc từ 600 triệu)”, trạng thái excluded, không báo lỗi. Không đọc khóa hoặc gọi Kiot.
- Cập nhật test POLICY trong Sale AI và BossTele; assertion giá tay cũ trong jul-batch/preoct/auto-table đổi sang loại trừ theo spec. Ca E2E 12 kiểm tra hàng không có trong bảng/select-all/excludedCodes và không ghi; giữ các ca khác của TASK-112/113.

## Bằng chứng

- Trước sửa, test mới `hidden-before-july.test.js` thất bại đúng hai lỗi: trả simulated cho hàng 600 triệu có giá tay và thiếu dòng số ẩn.
- Tại `Webstie/server`: `node --test --test-isolation=none src/sale-ai/test/hidden-before-july.test.js src/sale-ai/test/jul-batch.test.js src/sale-ai/test/preoct-m1.test.js src/sale-ai/test/fifteen-days.test.js src/sale-ai/test/note-first.test.js`: **43/43 đạt**, không skip.
- `node --test --test-isolation=none src/sale-ai/test/auto-table.test.js`: **5/5 đạt**.
- Tại BossTele: `node --test --test-isolation=none test/sale-price.test.js`: **7/7 đạt**, không skip.
- `node --test src/sale-ai/test/hidden-before-july.test.js`: sandbox chặn **spawn EPERM**.
- E2E tại server: `$env:SALE_AI_E2E='1'; ..\node_modules\.bin\vitest.cmd run src/tests/saleAiUpdateAll.test.ts`: sandbox chặn **spawn EPERM** ở esbuild khi tải config, chưa vào test. Không xác nhận E2E đạt.
- Lần thử redirect log suite dùng sai đường dẫn tương đối trỏ `D:\tasks-task115-core.log`, bị `Access denied`; chưa chạy test và không tạo được file ngoài workspace. Đã chạy lại không redirect.
- Suite lõi toàn bộ và build/test website được ghi bổ sung sau TASK-114; không dùng kết quả focused thay cho toàn bộ.

Không gọi Kiot/Sapo thật, không in khóa, không đọc `.env`, không dừng/restart server hoặc bot, không commit. Bảo toàn thay đổi chưa commit TASK-112/113; chưa kiểm chứng trình duyệt hoặc hệ thống thật.

## Kiểm tra chung cuối cùng sau TASK-114

- `node --test --test-isolation=none src/sale-ai/test/*.test.js` tại server: **218/218 đạt**, không fail/skip, exit 0, khoảng 182 giây, gồm ca 5.000 món. Đây là suite trong cùng tiến trình; không thay thế E2E router website.
- Lượt suite đầu khi đang hoàn thiện TASK-115: **209/210 đạt**; lỗi duy nhất `auto-table` còn assertion giá tay cũ. Đã đổi assertion sang bảng rỗng/số ẩn theo đặc tả và chạy lại focused 5/5, sau đó suite cuối 218/218 như trên. Không che lỗi lượt đầu.
- `npm.cmd run build --workspace server` tại Webstie đạt. `npm.cmd run build` bị chặn ở Vite frontend `spawn EPERM`, sau khi server và TypeScript frontend đạt. `npm.cmd test` bị Playwright `spawn EPERM`, chưa tới test server.
- BossTele `npm.cmd test` bị spawn EPERM ở 17 file. Fallback cả suite cùng tiến trình: **140 ca, 111 đạt, 29 lỗi**, không skip; 29 lỗi đều thuộc `test/add.test.js`, vì chính test CLI gọi `spawnSync node.exe` bị EPERM. Giá sale BossTele vẫn **7/7 đạt**; không sửa test CLI ngoài phạm vi.
- Reviewer chỉ đọc theo skill `requesting-code-review` kiểm tra diff TASK-115/114 và tự chạy 15 test report/history/hidden: **15/15 đạt**, không phát hiện lỗi cần sửa. Reviewer không phải Claude; trạng thái vẫn `ready_for_review`.
- `git diff --check` đạt; Node syntax checks các file production đã sửa đạt. Báo cáo chi tiết các giới hạn chung tại `TASK-114-result.md`.
