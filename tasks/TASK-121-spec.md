Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-121: Máy chủ sập khi Kiot đóng kết nối lúc ghi lô (lỗi nội bộ undici)

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Gấp**: Bảo đang chờ cập nhật giá.

## Sự cố thật 02/11/2026 13:50:16

- Lượt "Cập nhật giá Kiot" 1.112 món, ghi theo lô (TASK-120), bắt đầu 13:49:30.
  - Lô 1: 50 món thành công (`PUT /listupdatedproducts` chạy được trên Kiot thật).
  - Đang gửi lô 2 thì **tiến trình API (cổng 4000) chết hẳn**. `tsx watch` không tự bật lại; trang báo "Unexpected end of JSON input".
- Log:

```
node:internal/assert/utils:77
AssertionError [ERR_ASSERTION]: false == true
    at Parser.finish (node:internal/deps/undici/undici:7388:9)
    at TLSSocket.onHttpSocketEnd (node:internal/deps/undici/undici:7827:34)
    at TLSSocket.emit (node:events:526:24)
Node.js v24.21.0
```

- Đây là lỗi bên trong `fetch` (undici) của Node, xảy ra khi máy chủ Kiot đóng socket TLS. Lỗi ném ngoài mọi `try/catch` nên làm sập cả tiến trình. `KiotClient.request` (`lib/kiot.js:46-75`) gửi header `Connection: close` và dùng `fetch` toàn cục.
- Sau khi Claude bật lại máy chủ: lô 2 (50 món) thành `unknown`, 912 món `not_sent`.

## Yêu cầu

1. **Máy chủ không được sập** vì lỗi kết nối Kiot (cả GET lẫn PUT, đơn lẻ lẫn theo lô).
   - Codex tìm nguyên nhân gốc và chọn cách sửa nhỏ nhất, ghi lý do.
   - Hướng có thể: bỏ header `Connection: close` tự đặt; hoặc dùng `node:https` cho Kiot; hoặc cách khác đã kiểm chứng.
   - Không thêm dependency nếu không thật cần.
2. Khi kết nối hỏng giữa chừng:
   - PUT trả `unknown` (không gửi lại tự động), như quy tắc hiện có.
   - GET được thử lại như hiện có.
   - Lượt nền ghi nhật ký và đi tiếp (`continueOnError`) hoặc dừng sạch; không treo mãi. Timeout 30 giây vẫn áp dụng.
3. **Lưới an toàn**: nếu vẫn còn lỗi không bắt được, máy chủ ghi log rõ và đánh dấu lượt `interrupted` đúng như khi khởi động lại (`ready` thành `not_sent`, `sending` thành `unknown`). Không để trang treo ở "Đang kiểm tra và cập nhật" mãi. Không nuốt lỗi một cách im lặng.
4. Trang: khi API mất kết nối, báo câu dễ hiểu (ví dụ "Mất kết nối máy chủ Sale AI — xem Lịch sử sau khi máy chủ chạy lại"), thay cho "Unexpected end of JSON input".
5. Không đổi:
   - quy tắc giá, chỉ ghi giá Kiot (TASK-119), ghi lô 50 (TASK-120);
   - xác minh sau ghi, khoá, chạy nền.

## Test

- Kiot giả đóng socket giữa phản hồi của PUT lô (tái hiện bằng máy chủ HTTPS/HTTP cục bộ nếu được): tiến trình không chết; lô đó `unknown`; lô sau vẫn chạy.
- Tương tự với GET: thử lại theo quy tắc cũ.
- Phản hồi rỗng / JSON cắt cụt từ PUT: `unknown`, không sập.
- E2E `saleAiUpdateAll.test.ts` đạt.

## Lệnh kiểm tra (Claude chạy)

- `npm run build`, `npm test` tại `D:\Website_3Q\Webstie`.
- `node --test` lõi Sale AI.
- E2E 5 lần.
- `npm test` tại BossTele.

## Vùng code

`server/src/sale-ai/lib/kiot.js`, `runtime.ts`, `core.js`, `lib/service.js`, `public/live-ui.js` / `public/app.js`, `test/*`.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-121-result.md`.
