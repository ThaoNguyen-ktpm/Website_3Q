Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-122: Tăng tốc cập nhật giá Kiot theo lô

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Làm sau TASK-121 (sửa sập khi Kiot đóng kết nối).

## Yêu cầu của Bảo (02/11/2026)

> "ko cần cập nhật chỉ cần tối ưu tốc độ cập nhật"

## Số đo thật (nhật ký `kiot-state.store`)

| Lượt | Chế độ | Kết quả đo |
|---|---|---|
| 13:37:41 | từng món (GET + PUT + GET) | 199 món trong 160 giây, tức 1,24 món/giây; 1.311 món mất khoảng 18 phút |
| 13:49:30 | lô 50 (TASK-120) | lô 1 xác minh xong lúc 13:50:07, mất **37 giây**; sập lúc 13:50:16, giữa lô 2 (TASK-121) |

- Lô đầu chậm vì lượt nền (`localOnly`) gọi `client.all()` trước vòng lô (`batch-joint.js`, đoạn TASK-119/120). Ở máy chủ thật, hàm này đi qua `catalogStore.sync()` và đọc toàn bộ danh mục Kiot, khoảng 4.800 món.
- Mỗi lô sau gồm một `PUT /listupdatedproducts`, một `listModified` để xác minh và lưu nhật ký.

## Yêu cầu

1. **Đo trước khi sửa.** Lượt lô ghi `BAOQ timings` theo từng bước:
   - đọc đầu lượt;
   - mỗi lô: PUT, `listModified`, lưu nhật ký;
   - tổng thời gian và số request.

   Đo trên Kiot giả có độ trễ giống thật (lấy từ số đo ở trên). Ghi bảng trước/sau vào result.
2. **Bỏ đọc toàn bộ danh mục đầu lượt** nếu giữ được an toàn.
   - Thay bằng `listModified` từ thời điểm Kiot được đọc cho bảng (mốc của dữ liệu `liveBase`, cộng biên `MODIFIED_MARGIN_MS`): chỉ món đã sửa từ đó mới cần so dấu vân tay.
   - Nếu không có mốc tin cậy thì giữ đọc toàn bộ và ghi lý do.
   - Món bị sửa tay sau khi bảng đọc **vẫn phải bị chặn** (`preflight_failed`), như test TASK-120.
3. **Mỗi lô chỉ một lần đọc.** Lần `listModified` xác minh lô N dùng luôn để kiểm tra trước lô N+1 (đã có một phần). Không thêm GET từng món.
4. **Lưu nhật ký.** Không lưu cả state lớn nhiều lần mỗi lô nếu không cần. Giữ quy tắc: lô được lưu là "đang gửi" trước PUT, kết quả lưu sau.
5. **Cỡ lô.** Tra tài liệu KiotViet public API cho `PUT /listupdatedproducts`.
   - Nếu được phép hơn 50 món một lệnh thì đề xuất con số, ghi nguồn, đặt làm hằng số.
   - Không có nguồn thì giữ 50.
6. **Nhịp tiến độ.** Trang hỏi `/api/status` mỗi ~3 giây; giữ hoặc giảm tải nếu đo thấy tốn. Ước tính thời gian còn lại dựa trên tốc độ lô thật.
7. Không đổi:
   - quy tắc giá; chỉ ghi giá Kiot (TASK-119);
   - xác minh sau ghi (giá đúng, mô tả không đổi);
   - PUT không rõ kết quả thì `unknown`, không gửi lại;
   - khoá, chạy nền, hoàn tác.

## Mục tiêu

Với Kiot giả mô phỏng độ trễ thật: 1.112 món xong **dưới 2 phút**, không lô nào phải chờ đọc toàn bộ danh mục. Nếu không đạt, ghi bước nào chiếm thời gian.

## Test

- Lượt 1.311 món, Kiot giả có độ trễ: số request mỗi loại, tổng thời gian giả lập; không có `all()` toàn danh mục nếu yêu cầu 2 áp dụng được.
- Món bị sửa tay trên Kiot sau khi bảng đọc, trước khi gửi: vẫn `preflight_failed`.
- Món bị sửa giữa hai lô: vẫn bị chặn.
- E2E `saleAiUpdateAll.test.ts` đạt.

## Lệnh kiểm tra (Claude chạy)

- `npm run build`, `npm test` tại `D:\Website_3Q\Webstie`.
- `node --test` lõi Sale AI.
- E2E 5 lần.
- `npm test` tại BossTele.

## Vùng code

`server/src/sale-ai/lib/batch-joint.js`, `lib/live.js`, `lib/kiot.js`, `lib/service.js`, `runtime.ts`, `public/app.js`, `public/live-ui.js`, `test/*`.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không gọi Kiot/Sapo thật (đọc tài liệu web thì được). Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-122-result.md`.
