Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-119 — Kết quả triển khai

- Dự án: web / Sale AI.
- Người thực hiện: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai luồng chỉ giá Kiot, bổ sung test fixture và chỉnh E2E; kiểm tra tập trung và typecheck.
- Bước tiếp theo: Claude review độc lập, chạy build, toàn bộ test và E2E 5 lần theo spec. Chưa ghi `verified`.

## Thay đổi

- `Webstie/server/src/sale-ai/runtime.ts`: truyền `sapoWrite:false`, `kiotDescription:false` vào core thật. `catalogStore` hiện chỉ đồng bộ nguồn Kiot; không sửa kho tìm kiếm hay BossTele.
- `core.js`: truyền cờ mô tả vào live service và API view; khi Sapo tắt, không tự đọc Sapo lúc khởi tạo hoặc làm mới bảng. Giữ code/chỉ mục/cấu hình Sapo cũ.
- `lib/live.js`: lưu `kiotDescription` trong proposal và journal; kiểm tra “đã đúng giá” không còn đòi event BAOQ khi tắt ghi mô tả. Proposal cũ muốn ghi Sapo hoặc mô tả bị từ chối nếu cấu hình hiện tại đã tắt, phải xác nhận lại. Mặc định thư viện vẫn giữ hành vi cũ (`kiotDescription:true`) cho các fixture/luồng legacy; runtime thật truyền false rõ ràng.
- `lib/joint-update.js`, `lib/batch-joint.js`, `lib/batch-update.js`: với cờ false chỉ truyền `{basePrice}` tới adapter, không truyền `description`; giá đọc lại phải đúng và mô tả phải trùng snapshot trước ghi. Mô tả bị đổi sau PUT được ghi lỗi/chưa xác minh, không đánh dấu thành công. Bước ghi Kiot là “Gửi giá”. Giữ fingerprint, kiểm soát lỗi, khóa, background và checkpoint hiện có.
- `lib/restore.js`: journal mới cờ false chỉ khôi phục giá, không gửi mô tả. Quyết định theo cờ của lượt đã lưu, không theo cờ hiện tại. Lượt cũ không có cờ vẫn giữ semantics giá + mô tả. Khi runtime tắt Sapo, lượt cũ chứa platform Sapo bị chặn trước mọi GET/PUT với thông báo “Lượt cũ có Sapo — cần hoàn tác tay”. Khi bật Sapo ở fixture legacy, đường hoàn tác cũ vẫn chạy.
- `lib/view-data.js`, `public/live-ui.js`: history mang cờ mô tả và dấu hiệu có Sapo kể cả lượt cũ thiếu summary. Nút mới “Cập nhật giá Kiot (N món)”; vẫn hiển thị `notesBefore` và BAOQ `notePreview`, nhãn “Ghi chú tham khảo (không ghi lên Kiot):”. Lượt mới có nút hoàn tác giá Kiot; lượt Sapo cũ có cảnh báo hoàn tác tay, không hiện nút gửi rollback. Giữ lịch sử và cập nhật lại món lỗi.
- Không cần sửa `public/app.js`: tiến độ hiện lấy platform thực tế của lượt; lượt mới chỉ có `kiot`, nên không sinh dòng Sapo. Summary lượt mới cũng không có platform Sapo.

## Lựa chọn body Kiot và giới hạn xác minh

Đã kiểm tra `normalizeProduct`: `rawFields` chỉ gồm `name`, `code`, `categoryId`, **không có description**. Giữ adapter hiện tại: body PUT có các trường nhận dạng vốn có cùng `basePrice` (bulk thêm `id`), bỏ hoàn toàn trường `description`. Không chép mô tả cũ vào body vì không có bằng chứng từ API thật rằng bỏ trường này sẽ xóa mô tả. Có test gọi **KiotClient thật với fetcher giả lập**, kiểm tra JSON body đơn/lô không có description; test engine kiểm tra mô tả đọc lại không đổi.

Không gọi Kiot thật nên chưa xác minh semantics PUT của dịch vụ thật. Nếu dịch vụ thật làm mất/đổi mô tả, kết quả xác minh sẽ báo lỗi/chưa xác minh; không có PUT bù tự động. Đây là giới hạn cần Claude/Bảo biết, không phải bằng chứng đã kiểm thử trên shop.

## Test và bằng chứng

Tất cả thao tác mạng trong test dùng client/fetcher fixture riêng, store bộ nhớ hoặc cấu hình test; không đọc khóa hay gọi Kiot/Sapo thật.

1. `node --test Webstie/server/src/sale-ai/test/kiot-price-only.test.js` tại repo: **bị sandbox chặn `spawn EPERM`** trước khi chạy test. Không xin quyền.
2. Chạy riêng test mới bằng `--test-isolation=none` trước sửa: sau khi sửa cách nạp module UI cho đúng ánh xạ HTTP của ứng dụng, 8 ca thất bại và 1 ca adapter đạt, thể hiện hành vi chưa triển khai. Sau triển khai và mở rộng coverage: **11/11 đạt**.
3. Lệnh tập trung cuối:

   ```powershell
   node --test --test-isolation=none Webstie/server/src/sale-ai/test/kiot-price-only.test.js Webstie/server/src/sale-ai/test/history-details.test.js Webstie/server/src/sale-ai/test/background-ui.test.js
   ```

   **15/15 đạt**. Gồm 11 test mới: đơn/lô × trực tiếp/nền, giữ mô tả, không Sapo startup/refresh/update/restore, Sapo giá 0/thiếu chỉ mục không cản Kiot, phát hiện mô tả đổi, chặn proposal cũ, journal điều khiển rollback, stop engine cũ và body adapter, render nút/ghi chú/cảnh báo. Hai file UI có sẵn bổ sung kiểm tra polling và lịch sử.
4. Hồi quy legacy có chọn theo tên, **không chạy toàn bộ core**:

   ```powershell
   node --test --test-isolation=none --test-name-pattern="TASK-118|page update writes|products right on both|success sends price|rollback|restore|Kiot reload reads Sapo|rendered results" Webstie/server/src/sale-ai/test/joint-update.test.js Webstie/server/src/sale-ai/test/batch-joint.test.js Webstie/server/src/sale-ai/test/batch-update.test.js Webstie/server/src/sale-ai/test/restore-joint.test.js Webstie/server/src/sale-ai/test/sapo-auto-refresh.test.js
   ```

   **22/22 đạt**. Lần đầu có 1 lỗi do đổi nhãn journal cấu hình legacy; đã sửa code giữ nhãn cũ khi ghi mô tả, không nới test. Bao phủ hoàn tác hai bên, fingerprint/conflict và xử lý lỗi cũ, null/giá 0 theo TASK-118 khi còn bật Sapo.
5. `node ..\node_modules\typescript\bin\tsc --noEmit` tại `Webstie/server`: **đạt**, exit 0, không chẩn đoán.
6. `$env:SALE_AI_E2E='1'; & ..\node_modules\.bin\vitest.cmd run src/tests/saleAiUpdateAll.test.ts` tại server: **bị sandbox chặn `spawn EPERM`** ở esbuild khi nạp `vitest.config.ts`. Chưa chạy được case E2E nào; không thử lặp 5 lần khi điều kiện môi trường chưa đổi. Lần gọi đầu đường dẫn `server/node_modules/.bin/vitest.cmd` không tồn tại; đã dùng đúng binary ở workspace cha để xác nhận lỗi sandbox.
7. `git diff --check`: đạt, chỉ cảnh báo LF/CRLF của working tree. Không sửa test cũ để ép đạt.
8. `node --check` lần lượt với `core.js`, `lib/live.js`, `lib/joint-update.js`, `lib/batch-joint.js`, `lib/batch-update.js`, `lib/restore.js`, `lib/view-data.js`, `public/live-ui.js`, `test/kiot-price-only.test.js` trong Sale AI: tất cả đạt, exit 0. Kiểm tra diff lần cuối trong các file TASK-119 cũng đạt.

Rà soát nội bộ bằng agent chỉ đọc theo skill `requesting-code-review`: không phát hiện finding cần sửa trong phạm vi TASK-119. Đây không thay thế review độc lập của Claude; reviewer không chạy thêm test hay gọi dịch vụ thật.

## E2E đã cập nhật nhưng chưa chạy được

`Webstie/server/src/tests/saleAiUpdateAll.test.ts`: fixture mặc định tắt Sapo và mô tả Kiot; fake PUT giữ mô tả khi thiếu trường description. Các ca bình thường kiểm tra không có bất kỳ LIST/GET/PUT/RESTORE Sapo nào; adapter fixture kiểm tra chỉ basePrice. Chỉnh kỳ vọng Sapo thiếu chỉ mục, giá 0, thiếu SKU, lặp cùng ngày, hoàn tác và retry theo hành vi mới được spec yêu cầu. Các ca Sapo legacy null content/429 bật `legacy:true` (cả `sapoWrite:true`, `kiotDescription:true`) để giữ mục đích kiểm tra cũ. Core test giá 0 hai bên vẫn giữ nguyên.

## Điểm cần Bảo duyệt sau / giới hạn

- Theo giả định của Claude trong yêu cầu 6: món Sapo giá 0 nay vẫn được cập nhật giá Kiot như bình thường, vì luồng mới không đọc Sapo.
- Theo phương án yêu cầu 5: lượt cũ có Sapo cần hoàn tác tay khi runtime tắt Sapo. Dữ liệu lịch sử và code legacy được giữ; không tự hoàn tác bất kỳ lượt nào trên shop.
- Chưa chạy build, toàn bộ website/core/BossTele tests, E2E 5 lần hoặc trình duyệt thật; Claude chạy theo spec. Test tập trung in-process không thay thế các kiểm tra này.
- Không đổi quy tắc giá/POLICY, mốc 01/07, ngưỡng 600 triệu, BossTele, dependency; không commit. Không phát lệnh dừng/khởi động lại server, không bật bot, không in khóa. Repo đã có nhiều thay đổi chưa commit từ trước, được bảo toàn.
