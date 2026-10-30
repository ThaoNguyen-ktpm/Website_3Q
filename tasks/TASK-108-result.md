# TASK-108 — Kết quả triển khai

- Dự án: web, lõi Sale AI trong `Webstie/server/src/sale-ai/`.
- Người thực hiện: Codex. Người review tiếp theo: Claude.
- Trạng thái: `ready_for_review`.
- Ngày: 30/10/2026.
- Hành động gần nhất: triển khai tự đọc chỉ mục Sapo, bổ sung kiểm thử trên `core.js` thật và kiểm tra trong sandbox.
- Bước tiếp theo: Claude chạy build/test ngoài sandbox và kiểm tra giao diện ở 8787 theo đặc tả, không gọi dịch vụ thật nếu chưa được Bảo cho phép.

## Thay đổi

- `Webstie/server/src/sale-ai/core.js`:
  - `refreshTable()` giữ khóa `perform()` suốt lượt tải Kiot, tạo bảng và đọc chỉ mục Sapo. Route HTTP và người gọi trực tiếp cùng dùng khóa này.
  - Sau mỗi lần tải Kiot thành công, tự đọc lại Sapo đã cấu hình; nếu Sapo lỗi thì giữ kết quả Kiot và API vẫn thành công.
  - Sau khi lõi được trả về, lên lịch đọc nền một lần nếu Sapo đã cấu hình nhưng chưa ready. Đợi khóa rảnh, không giữ quá trình khởi tạo chờ mạng; thất bại chỉ log câu cố định, không log đối tượng lỗi upstream và không tự lặp gọi Sapo.
  - Đọc lại sau tải Kiot hoặc qua route tay vẫn xóa `prepared`. Startup chỉ xóa khi ID sản phẩm, ID phiên bản hoặc SKU thay đổi; khác thứ tự trả về không được coi là thay đổi chỉ mục.
  - Revision của dữ liệu real bao gồm trạng thái Sapo để polling tải lại giao diện sau thành công/thất bại nền, kể cả khi không ghi bảng Kiot hoặc xóa `prepared`.
- `Webstie/server/src/sale-ai/lib/sapo.js`: thêm `refreshError` trong trạng thái, chỉ chứa câu cố định; xóa lỗi khi đọc thành công. Không lưu thông tin lỗi upstream ra trạng thái. Giữ điều kiện ready/verified, đối chiếu SKU và đường ghi/khôi phục hiện có.
- `Webstie/server/src/sale-ai/public/live-ui.js`: bỏ hai nút đọc Sapo và panel kết nối; giữ hook settings để tương thích với nơi gọi. Chưa cấu hình vẫn báo như cũ; đọc lỗi hiển thị câu ngắn theo spec, kể cả khi đang giữ chỉ mục cũ ready. Khi chờ đọc thì không hiện dòng nhắc.
- `Webstie/server/src/sale-ai/test/sapo-auto-refresh.test.js`: 13 test mới, fixture bộ nhớ và client giả; đi qua `createSaleAi()`/handler của `core.js` thật. Test render chạy renderer thật và kiểm tra HTML đầu ra.
- `tasks/TASK-108-plan.md`: kế hoạch phạm vi và kiểm tra.

Không thêm dependency; không sửa công thức TASK-105, `sapoSku`, ghi giá, rollback hoặc kiểm tra trước/sau ghi. Không sửa hoặc nới test cũ. Các thay đổi chưa commit của task khác được giữ nguyên; toàn thư mục Sale AI vốn đã untracked trước TASK-108, không phải toàn bộ thư mục là code mới của task này.

## Bằng chứng kiểm tra

1. `node --test Webstie/server/src/sale-ai/test/sapo-auto-refresh.test.js` tại gốc: bị `spawn EPERM` khi Node tạo tiến trình test. Không xin quyền; chuyển sang `--test-isolation=none`.
2. Test mới trước khi sửa: 2 đạt, 7 lỗi đúng các hành vi chưa có. Hai test bổ sung về polling và thứ tự chỉ mục cũng được chạy thất bại trước khi sửa tương ứng.
3. `node --test --test-isolation=none Webstie/server/src/sale-ai/test/sapo-auto-refresh.test.js Webstie/server/src/sale-ai/test/sapo.test.js`: **21/21 đạt**, gồm 13 test mới và 8 test Sapo hiện có, sau thay đổi cuối về thứ tự chỉ mục.
4. Bộ lõi tại `Webstie/server`:
   - `node --test --test-isolation=none src/sale-ai/test/*.test.js`: sau sửa polling, trước bổ sung so thứ tự chỉ mục, **205/205 đạt**, exit 0. Log ở `$env:TEMP\task108-core-final.log`.
   - Lượt cuối sau mọi thay đổi: `node --test --test-isolation=none --test-name-pattern="^(?!5.000 products:)" src/sale-ai/test/*.test.js`: **206/206 đạt**, 0 bỏ qua, exit 0, khoảng 185 giây. Bộ lọc dự định bỏ benchmark không loại được test trong cách Node chạy cùng tiến trình; thực tế cả benchmark 5.000 món đã chạy và đạt. Log ở `$env:TEMP\task108-core-current.log`.
5. `npm.cmd run build --workspace server` tại `Webstie`, chạy lại sau thay đổi cuối: **đạt**, exit 0; gồm TypeScript và chép Sale AI vào dist.
6. `npm.cmd run build` tại `Webstie`: server build đạt; client TypeScript chạy xong nhưng Vite bị **spawn EPERM** khi nạp `client/vite.config.ts`. Không thể kết luận full build đạt.
7. `npm.cmd test` tại `Webstie`: Vitest bị **spawn EPERM** khi nạp `server/vitest.config.ts`; pipeline dừng trước bộ lõi. Bộ lõi đã được chạy riêng như trên. Không thể kết luận npm test toàn website đạt.
8. `node --check` cho `core.js`, `lib/sapo.js`, `public/live-ui.js`, test mới: đạt ở lượt kiểm tra cú pháp. Server build sau thay đổi cuối cũng đạt. `git diff --check`: exit 0; Git có cảnh báo chuyển LF/CRLF ở các file đã sửa sẵn của task khác.

Lượt lõi đầu tiên phát hiện hai test cũ thất bại vì thông báo thiếu chữ "chỉ mục": `manual mapping is not required for confirmed joint write; stale catalog still blocks` và `Sapo exact SKU index rejects missing/duplicate without requiring manual mapping`. Đã sửa thông báo ứng dụng thành "Đang đọc chỉ mục Sapo…", giữ nguyên test; các lượt sau đạt.

Test mới xác nhận: tải Kiot có chỉ mục Sapo và ready; Sapo lỗi không làm tải Kiot lỗi; thử lại sau tải Kiot; khởi động đọc một lần; không chặn lõi sẵn sàng; chờ khóa và chặn thao tác cạnh tranh; giữ/xóa prepared đúng nhánh; giữ prepared khi chỉ đổi thứ tự; revision phản ánh thay đổi Sapo; route tay còn dùng được; không gọi update/restore của client giả trong mọi luồng tự đọc; HTML không có hai nút hoặc panel cũ.

## Review và giới hạn

- Subagent Codex rà soát chỉ đọc, phát hiện vấn đề polling rồi kiểm tra lại bản sửa và so chỉ mục: không còn finding chặn bàn giao. Đây chưa phải review của Claude và không thay thế kiểm tra độc lập của Claude.
- Chưa kiểm tra trình duyệt thực tế ở 8787 hoặc phiên đăng nhập thật. Test HTML dùng VM chạy renderer với container tối thiểu, không chứng minh layout hoặc thao tác trình duyệt.
- Không gọi Kiot/Sapo thật, không đọc/in khóa, không gửi tin và không ghi giá hay mô tả thật. Các PUT trong log bộ test cũ thuộc adapter/fixture giả, không phải dịch vụ thật.
- Không dừng, khởi động lại hoặc chủ động khởi chạy máy chủ ứng dụng đang chạy. Các HTTP server tạm do test tự tạo chỉ phục vụ fixture kiểm thử.
- `refreshError` là trạng thái trong tiến trình, được xóa khi đọc thành công; không thêm kho lưu lỗi mới.
- Không commit. Chờ Claude kiểm tra trước khi đổi trạng thái thành `verified`.
