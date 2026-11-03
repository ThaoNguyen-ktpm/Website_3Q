Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-124 — Kết quả triển khai

- Dự án: web / Sale AI.
- Người thực hiện: Codex; ngày 02/11/2026.
- Trạng thái: `ready_for_review`. Code và test đã được viết; chưa được Claude kiểm tra độc lập, chưa xác nhận hết HTTP 420 trên Kiot thật.
- Hành động gần nhất: sửa framing request và trích lý do lỗi có che bí mật; kiểm tra cú pháp, rà diff.
- Bước tiếp theo: Claude chạy toàn bộ kiểm tra trong spec; sau đó Bảo xác nhận với 3–5 món trên Kiot thật theo spec. Codex không thực hiện bước thật này.

## Thay đổi

1. `Webstie/server/src/sale-ai/lib/kiot.js`
   - Chuyển body thành chuỗi đúng một lần, dùng `Buffer.byteLength(payload,'utf8')` làm `Content-Length`, rồi ghi chính chuỗi đó bằng UTF-8. Dùng cho cả JSON PUT và form POST auth, kể cả chuỗi rỗng. Xóa `Transfer-Encoding` nếu được truyền vào; ghi đè độ dài cũ, không sửa object header của caller.
   - Bổ sung mặc định `Accept: */*`, `User-Agent: node`, `Accept-Language: *`, `Sec-Fetch-Mode: cors`; giữ header caller tự đặt. Không thêm lại `Connection: close`.
   - Phản hồi không thành công chỉ giữ tối đa **2048 byte** trong bộ đệm; tiếp tục tiêu thụ phần còn lại, vẫn chịu deadline hiện có. Phản hồi thành công giữ cách xử lý cũ.
   - Chỉ lấy câu lỗi từ các trường JSON như `responseStatus.message`, `ResponseStatus.Message`, `message`, `error_description`. Che token/client ID/client secret đã biết, cả dạng URL-encoded/form-encoded; che thêm giá trị Bearer/Basic và trường secret/token/password có nhãn. Che giá trị dài trước giá trị ngắn, trước khi cắt câu xuống tối đa **500 ký tự** và bỏ ký tự điều khiển.
   - HTTP 420 có lý do hợp lệ thành `Kiot trả HTTP 420: <lý do đã che>`. JSON hỏng, phản hồi HTML, không có trường câu lỗi, hoặc JSON bị cắt bởi giới hạn: chỉ giữ thông báo HTTP cũ; không chép toàn bộ response, request body hay header vào thông báo/nhật ký.
   - Auth lỗi cũng có lý do đã che. HTTP 401 vẫn xóa token, giữ lời nhắc đăng nhập/thử lại; HTTP 429 giữ `Retry-After`; PUT 408/5xx vẫn `uncertain=true`; HTTP 420 vẫn lỗi ghi xác định. Không thêm retry.
2. `Webstie/server/src/sale-ai/test/kiot-transport.test.js`
   - Thêm test máy chủ HTTP loopback cho byte UTF-8 của JSON tiếng Việt, không chunked, header nghiệp vụ, body rỗng và header cũ sai, POST form auth.
   - Thêm test lý do 420 và che bí mật thô/encoded, không đưa các trường response khác vào thông báo; JSON hỏng/quá lớn, câu lỗi dài/ký tự điều khiển, auth lỗi.
   - Thêm test 401/408/429/500 giữ lý do, phân loại, Retry-After và PUT đúng một lần.
   - Giữ nguyên các test TASK-121: socket ngắt giữa body, GET thử lại/PUT không thử lại, JSON rỗng/cụt, deadline và status/Retry-After.
3. `tasks/TASK-124-plan.md`: kế hoạch trước sửa và giới hạn triển khai.

Không sửa lô 50, payload giá nghiệp vụ, bước xác minh, khóa, phục hồi, Sapo, frontend hoặc dependency. Working tree đã có nhiều thay đổi trước lượt này, trong đó `kiot.js` đã sửa và file test transport đã untracked; các thay đổi đó được giữ lại.

## So sánh header cũ/mới

Đối chiếu mã `fetch` cũ bằng `git show HEAD:Webstie/server/src/sale-ai/lib/kiot.js`, diff TASK-121 và mã undici tích hợp trong Node **v24.21.0** đang cài. Đây là đối chiếu mã/offline, không phải bắt request thật tại thời điểm 13:49. Không ghi giá trị khóa/token.

| Header | Trước TASK-121 (`fetch`) | TASK-121 trước sửa | TASK-124 |
|---|---|---|---|
| Content-Type, PUT JSON | `application/json` | Giữ nguyên | Giữ nguyên |
| Content-Type, auth POST | `application/x-www-form-urlencoded` | Giữ nguyên | Giữ nguyên |
| Retailer, API | Giá trị retailer cấu hình trong code | Giữ nguyên | Giữ nguyên |
| Authorization, API | `Bearer <đã che>` | Giữ nguyên | Giữ nguyên; auth POST không có header này |
| Accept | Fetch mặc định `*/*` | Không tự đặt | Mặc định `*/*` |
| User-Agent | Fetch của Node mặc định `node` | Không tự đặt | Mặc định `node` |
| Accept-Language | Fetch mặc định `*` | Không tự đặt | Mặc định `*` |
| Sec-Fetch-Mode | Fetch mặc định `cors` | Không tự đặt | Mặc định `cors` |
| Content-Length, có body | Fetch tự tính số byte body | Thiếu | Tính rõ số byte UTF-8 của chuỗi thực gửi |
| Transfer-Encoding, có body | Không chunked với body đã biết độ dài | Node có thể gửi chunked | Xóa header chunked, gửi Content-Length |
| Connection | Tự đặt `close` | Đã bỏ có chủ đích | Tiếp tục không tự đặt `close` |
| Host | Theo URL đích | Theo URL đích | Theo URL đích |
| Accept-Encoding | Fetch HTTPS có `br, gzip, deflate` | Không tự đặt | Giữ như transport native TASK-121: không quảng bá nén vì chưa có xử lý giải nén |

Các header nghiệp vụ và Accept/User-Agent trong yêu cầu đã được bổ sung/giữ nguyên. Khác biệt thương lượng nén của transport native được nêu rõ ở hàng cuối; không thêm cơ chế giải nén ngoài phạm vi bản sửa này.

## Kiểm tra đã thực hiện

Theo yêu cầu mới nhất, **không chạy test suite hoặc build**; Claude chạy tất cả test. Test được viết trước code ứng dụng, nhưng không có bằng chứng red/green trong lượt này.

- `node --check Webstie/server/src/sale-ai/lib/kiot.js`: exit 0.
- `node --check Webstie/server/src/sale-ai/test/kiot-transport.test.js`: exit 0.
- `git diff --check -- Webstie/server/src/sale-ai/lib/kiot.js`: exit 0. Phạm vi lệnh này là file tracked; file test và tài liệu mới đã rà nội dung riêng.
- Các kiểm tra trên chỉ xác nhận cú pháp/whitespace, không xác nhận hành vi HTTP hay kết quả test.
- Không có lệnh kiểm tra nào bị sandbox chặn trong lượt này; không yêu cầu approval. Một lệnh tra cứu dùng wildcard Windows và một lệnh Node inline bị lỗi cú pháp/quoting, đã đổi cách tra cứu; đó không phải kết quả test hay lỗi sandbox.

## Lệnh bàn giao Claude

Tại `D:\Website_3Q\Webstie\server`, ưu tiên nhóm tập trung:

```powershell
node --test src/sale-ai/test/kiot-transport.test.js src/sale-ai/test/kiot-errors.test.js src/sale-ai/test/kiot-batch-runtime.test.js src/sale-ai/test/batch-update.test.js
```

Sau đó theo spec:

- `D:\Website_3Q\Webstie`: `npm.cmd run build`, `npm.cmd test`.
- `D:\Website_3Q\Webstie\server\src\sale-ai\test`: `node --test *.test.js`.
- `D:\Website_3Q\Webstie\server`: `npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts`, chạy **5 lần**, ghi riêng kết quả từng lần.
- `D:\Website_3Q\Webstie\BossTele`: `npm.cmd test`.

## Giới hạn

- Chưa chạy các test mới/cũ, build, full core, E2E hoặc BossTele trong lượt này; chưa có review độc lập. Không dùng kết quả TASK-121 trước đó để tuyên bố bản sửa TASK-124 đạt.
- Chưa chứng minh chunked là nguyên nhân duy nhất gây HTTP 420. Chỉ đã xác nhận thiếu Content-Length và việc bỏ lý do HTTP theo code hiện tại.
- Không gọi Kiot/Sapo thật, không đọc `.env`, không in khóa thật, không dừng/khởi động lại server, không commit. Không chủ động nạp lại code vào server đang chạy.
