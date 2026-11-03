Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-124: Kiot từ chối lô giá (HTTP 420) sau khi đổi transport `node:https`

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Gấp.**

## Lỗi thật (02/11/2026 14:29)

- Lượt "Cập nhật giá Kiot" 1.311 món, ghi theo lô. Kết quả: 0 thành công, 151 `preflight_failed` ("Kiot thay đổi sau xác nhận"), **911 `write_failed` "Kiot trả HTTP 420"** ở bước "Gửi giá".
- Lúc 13:49, trước TASK-121, lô đầu 50 món ghi thành công qua `fetch` (undici) với cùng endpoint `PUT /listupdatedproducts`.
- Khác biệt chính: `kiotFetch` mới (`lib/kiot.js`, khoảng dòng 6–23) gọi `req.write(String(body))` mà **không đặt `Content-Length`**, nên Node gửi `Transfer-Encoding: chunked`. `fetch` cũ có đặt `Content-Length`. Đây là giả định mạnh nhất, chưa chứng minh.
- Khi HTTP không ok, `request()` huỷ body phản hồi, nên mất lý do Kiot trả về.

## Yêu cầu

1. `kiotFetch` gửi body có `Content-Length` = `Buffer.byteLength(body,'utf8')` (tên sản phẩm có tiếng Việt), không chunked. Áp dụng cho cả auth (form) và JSON.
2. Header gửi đi khớp với bản `fetch` cũ đã chạy được, trừ `Connection: close` đã bỏ có chủ đích: `Content-Type`, `Retailer`, `Authorization`, `Accept` nếu `fetch` cũ có gửi, `User-Agent` nếu cần. Ghi bảng so sánh header cũ/mới vào result.
3. Khi Kiot trả lỗi 4xx/5xx: đọc body (giới hạn ví dụ 2KB), lấy câu lỗi Kiot (ví dụ `responseStatus.message`), che bí mật, rồi đưa vào thông báo lỗi. Ví dụ: "Kiot trả HTTP 420: <lý do>". Không ghi token, header hay body gửi đi vào nhật ký.
4. Test bằng máy chủ HTTP cục bộ:
   - request PUT có `Content-Length` đúng số byte UTF-8, không có `transfer-encoding: chunked`;
   - phản hồi 420 có JSON lỗi thì thông báo chứa lý do;
   - giữ các test retry/timeout của TASK-121.
5. Không đổi: lô 50, chỉ ghi giá, xác minh, khoá, phục hồi.

## Lệnh kiểm tra (Claude chạy)

`npm run build`, `npm test`, `node --test` lõi Sale AI, E2E 5 lần, BossTele `npm test`.

## Cách làm

- Codex chạy `-a never`. Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-124-result.md`.
- Sau đó Bảo chạy thử **3–5 món** để xác nhận trên Kiot thật.
