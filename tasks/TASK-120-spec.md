Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-120: Sale AI ghi giá Kiot theo lô (nhiều món mỗi lệnh)

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Lượt 1.311 món lúc 13:37 đã được dừng theo yêu cầu Bảo (tắt máy chủ); giao ngay.
- Làm sau TASK-119 (chỉ ghi giá Kiot).

## Yêu cầu của Bảo (02/11/2026)

> "chỉnh lại số lượng mỗi lượt cập nhật trên kiot cập nhật nhìu mỗi lượt"

## Hiện trạng

- Máy chủ thật đang ghi Kiot **từng món**: mỗi món một GET, một PUT và một GET xác minh. Đo trên lượt thật 13:37: khoảng 1,2 món/giây, 1.311 món mất khoảng 18 phút.
- Đã có chế độ ghi theo lô (TASK-102), nhưng **chưa bao giờ bật trên máy chủ thật**:
  - `lib/batch-joint.js`, `LOT_SIZE=50`;
  - một lệnh `KiotClient.updateMany` (`PUT /listupdatedproducts`) cho cả lô;
  - xác minh lô bằng `listModified` (đọc các món vừa sửa);
  - lỗi gửi lô: 4xx là `write_failed`, timeout/5xx là `unknown`, không gửi lại.
- Chế độ này bật bằng `createSaleAi({batchWrites:true})` (`core.js:53`, `live.js:132`). `runtime.ts` chưa truyền nên đang tắt. Lô chỉ dùng khi `continueOnError` (bấm cập nhật nhiều món), không dùng cho hoàn tác.
- TASK-119 đã cho lô chỉ gửi `basePrice` khi `kiotDescription:false`.

## Yêu cầu

1. Máy chủ thật (`runtime.ts`) truyền `batchWrites:true`.
2. Giữ `LOT_SIZE=50`, trừ khi Codex tìm thấy trong tài liệu KiotViet giới hạn số món của `/listupdatedproducts` nhỏ hơn. Nếu có, theo giới hạn đó và ghi nguồn.
3. Xác minh sau ghi lô giữ nguyên độ chặt: giá đọc lại đúng, mô tả không đổi. Món không xác minh được là `unknown`, không coi là thành công.
4. **Đọc trước khi gửi giữ an toàn:**
   - Lượt nền (`localOnly`) đọc danh sách Kiot trước khi gửi và so dấu vân tay (đã có ở `batch-joint.js`).
   - Nếu `client.all()` đọc toàn bộ ~4.800 món mỗi lô thì quá chậm. Chỉ đọc một lần đầu lượt, rồi dùng `listModified` cho các lô sau như thiết kế TASK-102. Codex xác nhận và ghi lại.
5. Tiến độ trên trang hiện lô, ví dụ "Kiot lô 5/27 · 230/1.311". Hiện đã có `operation.batch` (`lot`, `lots`); chỉ sửa chữ nếu thiếu.
6. **Lượt bị dừng giữa chừng** (`lib/service.js:40-48`): khi khởi động lại, món có trạng thái `ready` (chưa gửi, `requestSent` không phải true) phải thành `not_sent` ("Chưa gửi — lượt bị dừng"), không phải `unknown`. Món `sending` vẫn là `unknown`. Lý do: lượt 13:37 bị dừng, 1.011 món chưa gửi bị báo "chưa xác định". Test cho cả hai trường hợp.
7. Không đổi:
   - quy tắc giá, `POLICY`;
   - chỉ ghi giá Kiot, không Sapo (TASK-119);
   - chạy nền (TASK-116), khoá (TASK-117);
   - hoàn tác (vẫn từng món).

## Rủi ro cần ghi trong result

- `PUT /listupdatedproducts` chưa từng chạy trên Kiot thật. Lượt thật đầu tiên Bảo nên chọn ít món (ví dụ 3–5 món, một lô), rồi xem giá trên Kiot trước khi chạy cả nghìn món.
- Một lô lỗi mạng làm tối đa 50 món thành `unknown`. Những món này cần "Cập nhật lại các món lỗi" hoặc kiểm tra tay.

## Test

- Lượt 1.311 món với Kiot giả có độ trễ: số lệnh PUT ≈ 27 (lô 50), không PUT từng món; tất cả `done`; không có lệnh Sapo nào.
- Lô có 1 món bị sửa tay trên Kiot ngay trước khi gửi: món đó `preflight_failed`, không vào lô; các món khác vẫn gửi.
- Lô bị lỗi 5xx/timeout: cả lô `unknown`, không gửi lại; lô sau vẫn chạy nếu `continueOnError`.
- Lô gửi xong nhưng 1 món đọc lại sai giá: chỉ món đó `unknown`.
- Body lô: chỉ `basePrice` và các trường nhận dạng, không có `description`.
- E2E `src/tests/saleAiUpdateAll.test.ts` đạt (fixture đã dùng `batchWrites:true`).

## Lệnh kiểm tra (Claude chạy)

- `npm run build` và `npm test` tại `D:\Website_3Q\Webstie`.
- `node --test` lõi Sale AI tại `server/src/sale-ai/test`.
- `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` tại `server`, 5 lần liên tiếp.
- `npm test` tại `BossTele`.

## Vùng code

`server/src/sale-ai/runtime.ts`, `lib/batch-joint.js`, `lib/live.js`, `lib/kiot.js` (chỉ nếu cần), `public/live-ui.js` hoặc `public/app.js` (chữ tiến độ), `test/*`, `src/tests/saleAiUpdateAll.test.ts`.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-120-result.md`.
