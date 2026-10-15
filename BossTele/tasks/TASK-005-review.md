# TASK-005 — Review độc lập

- **Người review:** Claude
- **Ngày:** 2026-10-14
- **Kết luận:** `ready_for_live_setup`. Code đủ để điền khóa thật và chạy thử chỉ đọc. Chưa đạt `verified` vì mới chạy trên API giả lập.

## Đã xem
`AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT-SEARCH.md`, `tasks/TASK-005-result.md`, `lib/product-search.js`, `search-products.js`, `test/product-search.test.js`, `package.json`, `config/connections.example.json`. Tôi không đọc `config/connections.local.json` hay bất kỳ file khóa nào, không gửi request ra ngoài và không sửa file nào.

## Kết quả test
`npm.cmd test` (Node v24.21.0): **42 test, 42 đạt, 0 lỗi**, chạy khoảng 1,96 giây. Kết quả khớp với báo cáo của Codex. Toàn bộ chạy với API giả lập.

## Điểm đạt
- **Chỉ đọc:** Kiot chỉ gửi POST để lấy token; mọi request còn lại đều là GET. Không có thao tác ghi, sửa giá hay xóa.
- **Bảo mật:**
  - `redirect: 'error'` và timeout 15 giây (`lib/product-search.js:65`).
  - Lỗi API chỉ trả mã và câu báo chung, không kèm nội dung phản hồi của API (`:69-74`, `:176`).
  - Domain Sapo bị giới hạn ở HTTPS `*.mysapo.net`, không cho kèm đường dẫn, cổng hay thông tin đăng nhập. Domain sai bị chặn trước khi gửi khóa (`:16-26`).
  - Khóa Basic đi trong header, không nằm trong URL.
  - SKU `.`/`..` bị chặn và SKU được `encodeURIComponent` nên không đi lệch đường dẫn.
- **Lỗi riêng từng nguồn:** dùng `Promise.all` và mỗi nguồn tự bắt lỗi, nên một nguồn hỏng không làm mất kết quả nguồn khác. Thiếu cấu hình thì không gọi API. POS báo `needs_api_contract` và không gửi request.
- **Phân trang:** Kiot dùng `currentItem = (page-1)*100`. Sapo dùng `page`/`limit=250`. Khi quét SKU Sapo mà chạm `maxPages`, kết quả báo `complete: false` kèm cảnh báo. Response sai định dạng bị coi là lỗi, không bị hiểu thành "danh mục rỗng".
- **CLI:** từ chối cờ lặp, cờ lạ, thiếu giá trị, hoặc dùng `--name` và `--sku` cùng lúc. `--page abc` cho ra NaN, bị từ chối với exit 1.

## Phát hiện
Không có lỗi chặn.

| # | Mức | Vị trí | Trường hợp lỗi cụ thể | Đề xuất |
|---|---|---|---|---|
| 1 | Trung bình (cần kiểm khi chạy thật) | `lib/product-search.js:136`, `:149` | Lọc theo tên phụ thuộc hoàn toàn vào tham số `name` (Kiot) và `query` (Sapo Web). Nếu API bỏ qua tham số này, `--name "Chanel"` sẽ trả trang đầu của **toàn bộ danh mục** với `status: ok`, trông như kết quả đúng. Code không tự lọc lại. | Khi chạy thật, tìm một tên chắc chắn không tồn tại; kết quả phải là `items: []`. Nếu không rỗng thì phải sửa code trước khi dùng. |
| 2 | Thấp | `lib/product-search.js:128`; test `test/product-search.test.js:52-55` | Kiot có `B01`, người dùng hỏi `--sku b01`. Nếu API khớp không phân biệt hoa/thường, kết quả là `status: error`, `invalid_response` ("API trả không khớp") và exit 2. Sapo Web trong cùng tình huống lại trả `ok` với `items: []`. Hai nguồn xử lý không nhất quán, và mã lỗi khiến người dùng tưởng API hỏng. | Trả `ok` với `items: []`, có thể thêm ghi chú lệch hoa/thường. |
| 3 | Thấp | `search-products.js:38`; `docs/PRODUCT-SEARCH.md:40` | `--source` mặc định là `all`, và POS luôn lỗi, nên **mọi** lần chạy mặc định đều exit 2, kể cả khi Kiot/Web thành công. Script gọi CLI không phân biệt được "lỗi thật" với "POS chưa triển khai". | Đã ghi trong tài liệu. Cân nhắc bỏ `needs_api_contract` khỏi điều kiện exit 2, hoặc đổi mặc định thành `kiotviet,sapo-web`. |
| 4 | Thấp | `lib/product-search.js:98` | `onHand` của Sapo lấy thẳng `inventory_quantity`. Với biến thể không quản lý tồn kho, giá trị có thể là `0`, dễ bị đọc thành "hết hàng". | Kiểm khi chạy thật. Nếu đúng như vậy, trả `null` khi biến thể không quản lý tồn. |
| 5 | Thấp | `lib/product-search.js:146-157` | Quét SKU Sapo theo `page` không cố định thứ tự. Nếu danh mục thay đổi giữa các trang, có thể sót hoặc lặp dòng. | Đã chấp nhận qua ghi chú `shortcut`. Chỉ cần nêu trong tài liệu. |
| 6 | Thấp (thiếu test) | `test/product-search.test.js` | Chưa có test cho: `hasMore` của Kiot khi thiếu `total`; token Kiot hết hạn phải lấy lại; Sapo tìm tên ở trang lớn hơn 1 có gửi đúng `page`; exit code 0/1/2 của `main()`. | Có thể bổ sung, không chặn bước tiếp theo. |

## Kết luận
`ready_for_live_setup`. Không có lỗi bảo mật hay lỗi làm mất dữ liệu. Các phát hiện số 2 đến 6 có thể sửa sau hoặc cùng lượt chạy thật.

Khi chạy thật để chuyển sang `verified`, cần làm được các việc sau, với khóa chỉ đọc:
1. Tìm tên có tồn tại và tên chắc chắn không tồn tại (phát hiện 1).
2. Tìm SKU đúng hoa/thường và lệch hoa/thường.
3. Xác nhận Kiot trả 404 khi SKU không tồn tại.
4. Xem thông tin phân trang (`total`, `hasMore`).
5. Thử khóa sai để thấy lỗi 401 không lộ khóa.

## Giới hạn
- Chỉ có test với API giả lập; chưa có bằng chứng nào trên Kiot hay Sapo thật.
- Tôi chưa đối chiếu lại tài liệu chính thức về tên tham số (`name`, `query`, `/products/code/{code}`) và cách Kiot trả lỗi 404. Những điểm này phải được chứng minh khi chạy thật.
- Sapo POS chưa có tài liệu API nên chưa review được, và không thể `verified` cho POS.
- Tôi không đọc file cấu hình thật, nên không biết khóa đã điền hay chưa.

---
Không kiểm: tài liệu API chính thức và hành vi khi chạy thật. Rủi ro chính: nếu API bỏ qua tham số tìm tên, công cụ sẽ trả toàn bộ danh mục như thể đó là kết quả tìm kiếm.