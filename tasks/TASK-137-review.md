Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-137 — Review của Claude

- Kết luận: **`changes_requested`**
- Ngày: 04/11/2026

## Bằng chứng

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt |
| `npm test` (Webstie) | shared đạt, frontend 6 đạt, server 491 đạt / 18 bỏ qua; **lỗi ở `test:sale-ai`** (3 test lõi bên dưới) |
| `node --test` lõi Sale AI | **427/430**, lỗi 3 |
| E2E ×5 | 18/18 cả 5 lần |
| BossTele | 112/112 |
| Bản chép dữ liệu thật (cổng 4599, không mạng, không bộ hẹn giờ), `autoUpdateAllowed` false | dòng "Máy này không chạy lịch (chỉ Laptop)", công tắc và Đổi giờ bị khoá — đúng |
| Như trên với `autoUpdateAllowed` true | Bật có khung xác nhận đúng mẫu → lưu `enabled:true`, "Lần tới: 10:00 Thứ Năm, 05/11"; Đổi giờ 14:30 có xác nhận → "Lần tới: 14:30 Thứ Tư, 04/11"; POST `25:00`, trường lạ `x`, `enabled:"yes"` → 400 cả ba; Console không lỗi |
| Kho thật `server/data/sale-ai` | không có `auto-update.json` (lịch chưa bật thật) |

## Lỗi

### Cao — 3 test lõi lỗi

1. `test/hidden-before-july.test.js:31` "600m boundary excludes even approved manual prices and preserves stored data": `AssertionError … undefined !== 1`. Tìm thay đổi TASK-137 làm mất trường/số đếm này; sửa code, không nới test.
2. `test/kiot-batch-runtime.test.js:121` "existing page progress renders lot number and processed/total": `ReferenceError: state is not defined`.
3. `test/sapo-rate-limit.test.js:120` "core status stays readable while the Sapo queue sleeps and UI polling shows the wait": `ReferenceError: statusOffline is not defined`.

Lỗi 2 và 3 nhiều khả năng do dòng mới `state.busy=state.busy||status.busy;` (`public/app.js:268`) và thay đổi vòng poll, làm hỏng các test nạp riêng đoạn poll/renderProgress. Sửa sao cho test cũ chạy đúng mà vẫn giữ hành vi mới; chỉ được chỉnh harness test nếu thực sự cần, và ghi rõ lý do.

### Thấp — độ trễ hiển thị sau khi bấm Đồng ý

Bấm Đồng ý để Bật thì máy chủ lưu ngay, nhưng dòng trạng thái vẫn ghi "Tắt" khoảng 1–5 giây, tới vòng poll sau mới đổi "Bật". Cần cập nhật giao diện ngay từ phản hồi POST.

## Yêu cầu khi sửa

Chạy lại `node --test --test-isolation=none` cho ba file trên và `auto-update*.test.js`. Không gọi Kiot/Sapo thật, không đọc `.env`, không bật lịch thật, không restart server, không commit.

## Kiểm tra lại sau sửa (04/11/2026 ~11:45)

- Kết luận mới: **`verified`** (giới hạn ở dưới).
- Bốn finding đã sửa. Lỗi 1 là lỗi thật: cache Lịch sử của `AutoUpdate.history()` không theo `state.updates`. Lỗi 2: `renderProgress` nhận trạng thái qua tham số. Lỗi 3: harness VM thêm phụ thuộc mới, assertion giữ nguyên. Lỗi 4: render ngay từ phản hồi POST.

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt |
| `npm test` (Webstie) | shared, frontend 6, server 491 đạt / 18 bỏ qua; `test:sale-ai` đạt |
| `node --test` lõi Sale AI | 431/431 |
| E2E ×5 | 18/18 cả 5 lần |
| BossTele | 112/112 |

## Giới hạn

- Chưa chạy lịch thật trên Kiot. Lần chạy thật đầu tiên là khi Bảo thêm `SALE_AI_AUTO_UPDATE=1` trên Laptop, khởi động lại web và bật công tắc. Sau lượt đầu, Claude cần đọc Lịch sử và `BAOQ timings`.
- Giao diện được kiểm trên bản chép dữ liệu, không mạng, không bộ hẹn giờ. Chưa kiểm khi đăng nhập Admin qua 8787.
