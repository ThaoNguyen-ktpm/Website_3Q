Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-126: Cắt hai bước chậm của lượt cập nhật giá Kiot (đọc toàn danh mục, lưu nhật ký lớn)

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Bảo yêu cầu triển khai 02/11/2026. Làm sau TASK-125 (hoặc cùng lượt nếu TASK-125 đã xong).

## Số đo thật (log máy chủ `BAOQ timings`, 02/11/2026 ~15:00)

| Lượt | Đọc đầu lượt (`initialReadMs`) | PUT lô | `listModified` | `saveMs` | Tổng |
|---|---|---|---|---|---|
| 1 lô | 36.157 ms (59 trang) | 765 ms | 346 ms | 30.088 ms | 67.383 ms |
| 0 lô | 35.582 ms | — | — | 90 ms | 35.682 ms |
| 0 lô | 32.561 ms | — | — | 71 ms | 32.634 ms |
| 1 lô, 1.305 món (1.301 xong) | 32.381 ms | 698 ms | 445 ms | 22.474 ms | 56.016 ms |

Ghi giá thật chỉ mất khoảng 1,2 giây mỗi lô. Gần như toàn bộ thời gian nằm ở hai bước sau.

### 1. Vẫn đọc toàn bộ danh mục đầu lượt

- TASK-122 chỉ dùng `listModified` khi dòng bảng có mốc đọc tin cậy (`liveReadAt` / `state.kiotReadAt`, `lib/live.js:108-113,153,212`). Bảng thật dựng trước TASK-122 nên không có mốc, rơi về `client.all()` (59 trang, khoảng 32–36 giây).
- Kể cả có mốc, mỗi lượt vẫn phải chắc chắn không bỏ sót món bị sửa tay.

### 2. Lưu nhật ký rất nặng

- `server/data/sale-ai/kiot-state.store` hiện 139 MB, 4.767 blob. Sáng 02/11 sau dọn dẹp là khoảng 40 MB.
- Blob lớn nhất 18,1 / 16,4 / 16,0 / 9,2 / 8,4 MB, nhiều khả năng là nhật ký lượt 1.311 món chứa toàn bộ `before` / `afterProduct` / `rawFields` từng món, cùng các bảng `runs`.
- Mỗi lần lưu ghi lại cả blob nên `saveMs` 22–30 giây, và kho phình thêm sau mỗi lượt.

## Yêu cầu

1. **Bỏ đọc toàn danh mục khi có thể.**
   - Bảng mới và bảng cũ đều phải có mốc đọc tin cậy. Nếu bảng cũ thiếu mốc, cách sửa nhỏ nhất có thể là: lần "Tải lại từ Kiot" hoặc làm mới tự động ghi `kiotReadAt`.
   - Lượt nền dùng `listModified(mốc - MODIFIED_MARGIN_MS)`.
   - Chỉ khi thật không có mốc mới đọc toàn bộ. Khi đó trang báo "Đang đọc toàn bộ Kiot (~30 giây) vì bảng chưa có mốc; bấm Tải lại từ Kiot để lần sau nhanh hơn".
   - An toàn giữ như TASK-120/122/125: món bị sửa tay sau mốc vẫn bị chặn.
2. **Nhật ký gọn.** Mỗi món trong nhật ký chỉ lưu những gì cần cho xác minh, hoàn tác, lịch sử và "Cập nhật lại các món lỗi":
   - mã, tên, giá trước/sau, dấu vân tay, trạng thái, lỗi, thời điểm;
   - mô tả trước, chỉ khi còn cần cho hoàn tác lượt cũ.

   Không chép nguyên `rawFields` / sản phẩm Kiot nhiều lần trong cùng một món. Lượt cũ đã lưu vẫn đọc và hoàn tác được (tương thích ngược, có test).
3. **Lưu ít và nhỏ hơn mỗi lô.** Checkpoint mỗi lô không ghi lại cả blob lớn nếu tránh được: tách theo lô, ghi phần thay đổi, hoặc cách khác đã đo. Vẫn giữ quy tắc lô được lưu là "đang gửi" trước PUT, kết quả lưu sau; lỗi lưu thì không gửi tiếp.
4. **Dọn kho.** Chạy cơ chế dọn có sẵn (`lib/retention.js`, `lib/store-cleanup.js`, giữ 7 lượt) để blob không còn tham chiếu được xoá, và có test. Codex **không** tự xoá dữ liệu thật; chỉ sửa code dọn. Máy chủ tự dọn ở lần khởi động hoặc lưu kế tiếp như thiết kế hiện có.
5. **Đo lại và ghi bảng trước/sau** vào result, dùng Kiot giả có độ trễ theo số đo thật ở trên (PUT 0,7 s, `listModified` 0,4 s, trang `all()` khoảng 0,6 s). Đo cả `saveMs` trên thư mục tạm thật, không phải store bộ nhớ, với dữ liệu cỡ thật (4.800 sản phẩm, 1.311 món).

## Mục tiêu

Lượt 1.311 món (27 lô) trên Kiot giả theo số đo thật: **tổng dưới 60 giây**, đọc đầu lượt dưới 2 giây (khi có mốc), `saveMs` cả lượt dưới 5 giây. Kho không tăng quá vài MB mỗi lượt. Không đạt thì ghi rõ bước nào chiếm thời gian.

## Không đổi

- Quy tắc giá; chỉ ghi giá Kiot; lô 50.
- Xác minh sau ghi; PUT không rõ kết quả thì `unknown`, không gửi lại.
- Khoá, chạy nền, phục hồi khi gián đoạn, transport `node:https` + `Content-Length` (TASK-121/124).
- BossTele đọc `pricing.js` và kho Kiot: phải chạy đúng như cũ. Kiểm tra BossTele đọc phần nào của `kiot-state.store` trước khi đổi định dạng.

## Test

- Bảng có mốc: lượt 1.311 món không gọi `all()`; món bị sửa tay sau mốc vẫn bị chặn.
- Bảng cũ không mốc: rơi về `all()` kèm thông báo; sau "Tải lại từ Kiot" thì có mốc.
- Kích thước blob nhật ký lượt 1.311 món giảm rõ (ghi số trước/sau); lượt cũ định dạng cũ vẫn xem Lịch sử, hoàn tác và cập nhật lại được.
- Dọn kho xoá blob không tham chiếu, giữ đủ 7 lượt.
- E2E `saleAiUpdateAll.test.ts` đạt; BossTele `npm test` đạt.

## Lệnh kiểm tra (Claude chạy)

`npm run build`, `npm test`, `node --test` lõi Sale AI, E2E 5 lần, BossTele `npm test`.

## Vùng code

`server/src/sale-ai/lib/live.js`, `lib/batch-joint.js`, `lib/joint-update.js`, `lib/service.js`, `lib/store.js` (SplitStore), `lib/retention.js`, `lib/store-cleanup.js`, `lib/restore.js`, `lib/view-data.js`, `public/app.js`, `test/*`, `src/tests/saleAiUpdateAll.test.ts`; đọc `BossTele/` phần dùng kho Kiot.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không gọi Kiot/Sapo thật. Không xoá dữ liệu trong `server/data/`. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-126-result.md`.
