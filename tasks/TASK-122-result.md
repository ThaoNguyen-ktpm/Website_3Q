Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-122 — Kết quả

- Dự án: web / Sale AI.
- Người thực hiện: Codex.
- Trạng thái: `ready_for_review`; chưa được Claude kiểm tra độc lập. **Mục tiêu dưới 2 phút chưa đạt trong mô hình bảo thủ đã dùng.**
- Hành động gần nhất: đo trước tối ưu, thay preflight toàn danh mục bằng delta có mốc tin cậy, giảm checkpoint trùng và đo lại cùng fixture.
- Bước tiếp theo: Claude kiểm tra toàn bộ suite/E2E; đối chiếu `BAOQ timings` thực tế khi Bảo cho phép vận hành. Lượt này không gọi API shop.

## Triển khai

- `lib/live.js`: ghi `kiotReadAt` trước khi bắt đầu `client.all()` thành công; mỗi snapshot có `liveReadAt` tương ứng với `liveBase`. Bản xác nhận localOnly lấy mốc sớm nhất của các row được chọn. Không lấy giờ xác nhận làm mốc đọc. Bảng cũ, thiếu mốc, mốc không hợp lệ hoặc nằm trong tương lai giữ `all()` tại send gate để an toàn. Refresh dùng native KiotClient sau TASK-121.
- `lib/batch-joint.js`: dùng `listModified(listAt - MODIFIED_MARGIN_MS)` cho preflight. Lần đọc xác minh lô N tiếp tục cung cấp dữ liệu kiểm tra lô N+1; không có GET từng món. Không giảm biên 30 giây.
- `lib/kiot.js`: delta yêu cầu `includeRemoveIds=true` và giữ `removeId` thành tombstone; món đã bị xóa cũng bị chặn trước PUT. Kiểm tra kiểu ID/danh sách trước khi tin phản hồi. `all()` ghi số trang thực tế vào `lastPages`.
- Journal vẫn lưu toàn bộ lô ở `sending` trước PUT. Checkpoint trước lô N+1 lưu luôn kết quả lô N; kết quả lô cuối và attempt hoàn tất được transaction lưu trước khi trả kết quả. Bỏ ba lượt lưu trùng của commit/batch-final/finishAttempt trên nhánh batch. Nhánh từng món và hoàn tác giữ checkpoint riêng như trước. Khi lỗi lưu, không được gửi tiếp.
- `BAOQ timings` có `batch.initialReadMs`, `batch.lots[]` với PUT/listModified/journal theo lô, tổng batch và bộ đếm đọc/ghi. Log transaction có tổng thời gian thật, thời gian lưu, network/auth, số request qua danh sách `requests`. `batch.reads` là số trang GET hoàn tất theo client; không coi nó là tổng retry/auth HTTP trên dây khi có lỗi.
- Giữ status polling 3 giây và ETA từ trung bình ba lô gần nhất, gồm cả lưu/đọc/ghi và thời gian nghỉ giới hạn. Chưa có số đo cho thấy polling là nút thắt; không tăng tần suất.

## Cỡ lô và nguồn

Đã đọc [Public API KiotViet, mục 2.4.8](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-ket-noi-api/public-api/) ngày 02/11/2026: tài liệu có `PUT /listupdatedproducts`, nhưng không nêu giới hạn đủ để khẳng định hỗ trợ hơn 50 món/lệnh. Giữ hằng số `LOT_SIZE=50`, không tự tăng. Cùng tài liệu, mục 2.4.1 mô tả `includeRemoveIds`/`removeId` và phân trang GET tối đa 100 dòng.

## Đo trước/sau

Đo bằng `test/batch-speed.test.js`, dùng Simulator/LiveService thật với client và store trong bộ nhớ; đồng hồ mạng giả lập, không chờ mạng thật. Instrumentation được thêm trước thay đổi thuật toán và đã chạy baseline trước khi bỏ full read.

**Giả định, không phải số đo shop:** giữ giả định cũ 5.000 ms/bulk PUT, 400 ms/trang modified GET. Gán 31.200 ms cho một lần đọc toàn danh mục để lô đầu tương ứng 37.000 ms trong spec: 31.200 + 400 preflight + 5.000 PUT + 400 verify. Nhật ký thật chưa tách GET/PUT nên không thể xác nhận duy nhất cách phân bổ này. Fixture có tính các trang delta bị lặp do biên 30 giây, không giả định mỗi delta luôn chỉ một trang. Không có độ trễ đĩa giả; xử lý/lưu bộ nhớ được đo riêng bằng thời gian thật.

| Số món | Trước tối ưu | Sau tối ưu | all() đầu lượt | Delta calls | GET delta pages | Bulk PUT | Số lần lưu trước → sau |
|---|---:|---:|---|---:|---:|---:|---|
| 1.112 | 172.600 ms | 141.400 ms | 1 → 0 | 24 → 24 | 66 → 66 | 23 → 23 | 28 → 25 |
| 1.311 | 197.400 ms | 166.200 ms | 1 → 0 | 28 → 28 | 78 → 78 | 27 → 27 | 32 → 29 |

`all()` là một lời gọi logic có chi phí mô hình toàn danh mục; baseline progress cũ chỉ đếm nó là một lần, không phải một trang HTTP thật. Nếu quy đổi danh mục khoảng 4.800 món trong spec thành 48 trang, tổng GET mô hình trước/sau lần lượt là 114 → 66 và 126 → 78; đây là phép quy đổi giả định, không phải request đếm trên mạng shop. Auth không được mô hình hóa. Không có GET/PUT từng món và không có Sapo request trong benchmark.

Sau tối ưu:

- 1.112 món: đọc đầu lượt 400 ms, PUT tổng 115.000 ms, đọc xác minh tổng 26.000 ms. Giảm 31.200 ms nhưng vẫn vượt 120.000 ms. Nút thắt là 23 PUT tuần tự cùng các trang xác minh/biên thời gian. Không đổi lô, giảm xác minh hay gửi lô đồng thời để ép số đo đạt.
- 1.311 món: đọc đầu lượt 400 ms, PUT tổng 135.000 ms, xác minh 30.800 ms.
- Một lượt kiểm tra cuối đo thời gian lưu bộ nhớ thực khoảng 627 ms / 866 ms tương ứng hai quy mô; các số này biến động theo máy, không đại diện đĩa production và không cộng vào đồng hồ mạng giả lập ở bảng.

## Kiểm tra và file liên quan

Các file sản phẩm: `lib/live.js`, `lib/batch-joint.js`, `lib/kiot.js`; `runtime.ts` được hoàn thiện ở TASK-121. Test: `test/batch-speed.test.js`, `test/kiot-batch-runtime.test.js`, `test/kiot-transport.test.js`, và case legacy cursor trong `test/background-update.test.js`.

Tại `Webstie/server`:

```powershell
node --test --test-isolation=none src/sale-ai/test/kiot-transport.test.js src/sale-ai/test/background-ui.test.js src/sale-ai/test/runtime-fatal.test.js src/sale-ai/test/kiot-price-only.test.js src/sale-ai/test/kiot-batch-runtime.test.js src/sale-ai/test/batch-speed.test.js
node --test --test-isolation=none --test-skip-pattern="5[.]000" src/sale-ai/test/batch-joint.test.js
node --test --test-isolation=none --test-name-pattern="fatal interruption|shutdown drains|background batch catches|background failure" src/sale-ai/test/background-update.test.js
```

Lần lượt đạt 42/42, 10/10 và 4/4 ở các nhóm tập trung. Có test 1.311 món với số lô/request, sửa tay từ trước xác nhận, sửa giữa các lô, fallback bảng cũ không có cursor, món bị xóa, JSON/mạng lỗi, giá/mô tả xác minh không khớp, không tự gửi lại, và journal trước PUT. Thay đổi kỳ vọng test cũ từ `all()=1` sang `all()=0` là hành vi chủ đích của spec; case cũ bỏ qua delta được giữ bằng cách xóa cursor để kiểm tra fallback.

Typecheck server và `git diff --check` đạt. Server build và frontend typecheck đạt trong `npm.cmd run build`; frontend bundling bị `spawn EPERM`. `npm.cmd test` bị chặn ở Playwright frontend. Vitest E2E `saleAiUpdateAll.test.ts`/runtime bị `spawn EPERM` khi nạp config. Chưa có bằng chứng E2E đạt hay 5 lượt E2E.

Không chạy full core in-process; Claude phụ trách full core/website/BossTele và review. Không cài dependency, không sửa quy tắc giá, không gọi Kiot/Sapo thật, không in khóa, không stop/restart server, không commit. Mục tiêu tốc độ thật chưa xác minh; mục tiêu mô phỏng dưới 2 phút chưa đạt, đã nêu nút thắt theo yêu cầu spec.
