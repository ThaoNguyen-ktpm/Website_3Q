# Review lại TASK-005: Tìm sản phẩm

**Người review:** Claude
**Kết luận:** `ready_for_live_setup`

## Hai yêu cầu từ lần review trước

| Yêu cầu | Code | Test |
|---|---|---|
| Lọc lại tên sau khi API trả kết quả | Có, `lib/product-search.js:62-64`. Dùng cho tìm tên ở Kiot (`:144`, so với `fullName \|\| name`) và Sapo Web (`:158`, so với tên ghép `sản phẩm — biến thể`). Không phân biệt hoa/thường, vẫn phân biệt dấu, đúng như `docs/PRODUCT-SEARCH.md:34`. | Có, `test/product-search.test.js:155-165`. Bỏ dòng "Other brand" ở cả Kiot và Web, giữ "CHANEL Classic" nên có kiểm cả hoa/thường. |
| Biến thể không quản lý tồn kho trả `onHand: null` | Có, `lib/product-search.js:102`. Khi `inventory_management` rỗng thì trả `null` thay vì đọc `inventory_quantity`. | Có, `:161-164` với `inventory_management: null`. Trường hợp có quản lý tồn kho vẫn trả số lượng, đã kiểm ở `:70` (`onHand: 2`). |

Có thêm một thay đổi: giá Kiot là chuỗi trắng thì trả `null` (`:57`). Test kiểm ở `:160`.

## Phát hiện (mức thấp, không chặn)

1. **`hasMore` của Sapo Web khi tìm tên được tính trước khi lọc.** Ở `lib/product-search.js:159`, nếu API Sapo bỏ qua `query` thì một trang có thể trả `items: []` trong khi `hasMore: true`. Tài liệu `docs/PRODUCT-SEARCH.md:34` mới ghi điều này cho Kiot. Nên ghi thêm cho Sapo Web, chỉ cần sửa tài liệu, không phải sửa code.
2. **Test lọc tên chưa có trường hợp tên chứa dấu tiếng Việt.** Hành vi phân biệt dấu đã được ghi rõ nên chấp nhận được. Có thể thêm test khi chạy thật cần hành vi khác.

## Giới hạn

- Tôi đọc log mới nhất `tasks/TASK-005-tests.txt` (43/43 pass, 0 fail), nhưng **không tự chạy test** trong lần review này. Theo yêu cầu, tôi cũng không chạy lệnh và không sửa file nào, kể cả không ghi `tasks/TASK-005-review.md`.
- Chỉ đọc 4 file đã chỉ định. Không đọc `search-products.js`, `config/connections.local.json` hay cấu hình cục bộ khác.
- **Việc kết nối thật với Kiot/Web vẫn chưa làm**, nên chưa có bằng chứng tích hợp thật. **Hợp đồng API Sapo POS cũng vẫn đang chờ**, hiện chỉ trả `needs_api_contract`.

---
Chưa kiểm: phần xử lý tham số dòng lệnh trong `search-products.js` và cách API thật xử lý `query`/`name`.
Rủi ro: nếu API thật bỏ qua bộ lọc tên, người dùng sẽ phải xem qua nhiều trang rỗng, nên cần kiểm khi chạy thật.