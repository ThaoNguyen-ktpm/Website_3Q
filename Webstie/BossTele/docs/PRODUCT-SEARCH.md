# Tìm sản phẩm KiotViet, Sapo Web và Sapo POS

## Hiện trạng
Đã có công cụ CLI Node.js tìm sản phẩm chỉ đọc cho KiotViet Retail và Sapo Web. Ngày 2026-10-14 đã kết nối thật qua `.env` và tìm tên trên cả hai nguồn; bằng chứng tại `tasks/TASK-006-live.json`. Sapo POS cần tài liệu endpoint và xác thực do Sapo cấp trước khi triển khai; công cụ hiện báo `needs_api_contract` và không gửi request POS.

Đây là công cụ kết nối nhỏ dùng Node có sẵn, chưa chọn stack cho toàn bộ ứng dụng định giá. Không có web server hoặc giao diện web trong tác vụ này.

## Điền cấu hình cục bộ
File ưu tiên: `.env` tại gốc BossTele. Tên biến theo đúng cấu hình người dùng:
```dotenv
KIOT_RETAILER=baoqluxury
KIOT_CLIENT_ID=
KIOT_CLIENT_SECRET=
SAPO_SHOP=baoqluxury.mysapo.net
SAPO_API_KEY=
SAPO_API_SECRET=
```
Đã có `.env.example` không chứa khóa. Với private app Sapo, API key/secret dùng Basic Authentication. Nếu dùng OAuth, có thể dùng `SAPO_ACCESS_TOKEN` thay cho cặp basic. Nếu secret chứa `#` hoặc khoảng trắng, đặt giá trị trong dấu nháy.

Nếu `.env` tồn tại thì chỉ dùng bộ giá trị từ file đó, không tự bù khóa trống từ biến môi trường/JSON. Nếu không có `.env`, dùng các biến môi trường cùng tên khi có; cuối cùng mới dùng JSON cũ `config/connections.local.json` (mẫu `config/connections.example.json`). Các file chứa khóa đã được thêm vào `.gitignore`; không gửi khóa lên chat hoặc commit. Agent không tự lấy khóa từ dự án khác.

- KiotViet: `kiotviet.retailer`, `clientId`, `clientSecret`.
- Sapo Web private app: `sapoWeb.domain` dạng `ten-shop.mysapo.net`, `authType: "basic"`, `apiKey`, `apiSecret`.
- Sapo Web OAuth: `authType: "token"`, `accessToken`, bỏ trống hai trường basic.
- Sapo POS: giữ `sapoPos` để chuẩn bị cấu hình; chưa diễn giải `baseUrl`/`accessToken` là đủ kết nối khi hợp đồng API chưa được xác minh. Cung cấp link tài liệu hoặc file đặc tả do Sapo cấp.

Ưu tiên khóa có quyền đọc sản phẩm. CLI không có thao tác sửa giá, thêm/xóa sản phẩm hay đồng bộ ghi.

## Chạy
Tại `D:\Website_3Q\BossTele`, Node >= 22:
```powershell
node search-products.js --status
node search-products.js --source kiotviet --name "Chanel"
node search-products.js --source sapo-web --name "Chanel"
node search-products.js --source all --sku SP000001
node search-products.js --source kiotviet --name "Chanel" --page 2
npm.cmd test
```

`--status` chỉ kiểm tra cấu hình, không xác minh kết nối API. `configured_not_connected` nghĩa là đã đủ trường, không chứng minh khóa hợp lệ.

Kết quả JSON tách riêng từng nguồn, gồm ID sản phẩm/biến thể, SKU, tên, giá đang lưu và tồn kho nếu API cung cấp. Kiot/Sapo giữ ID riêng; không gộp sản phẩm chỉ vì giống tên. Tồn Kiot tổng hợp các nhánh mà response cung cấp, không khẳng định đầy đủ mọi chi nhánh nếu tài khoản/API giới hạn quyền. Giá được đọc trực tiếp, không tính chính sách lợi nhuận hay tự suy ra giá thu.

## Phân trang và giới hạn
- Tìm tên: một trang mỗi lần, `--page` để xem tiếp; Kiot 100 sản phẩm/trang, Sapo Web 250 sản phẩm/trang. Kết quả có `hasMore`. Công cụ lọc lại tên theo chuỗi con, không phân biệt hoa/thường (vẫn phân biệt dấu). `total` của Kiot và `hasMore` của cả Kiot/Sapo Web dựa trên tập kết quả API trước lọc cục bộ; nếu API bỏ qua bộ lọc thì cần xem thêm trang, không được coi trang rỗng là không có trong toàn danh mục.
- Tìm SKU Kiot: gọi endpoint theo mã và đối chiếu chính xác, phân biệt hoa/thường.
- Tìm SKU Sapo Web: đọc tuần tự các trang sản phẩm rồi lọc SKU biến thể chính xác; mặc định tối đa 20 trang, có thể chọn `--max-pages` từ 1 đến 100. Không dừng ở kết quả đầu tiên để không giấu SKU trùng.
- `complete: false` nghĩa là chưa quét hết danh mục, không được kết luận SKU không tồn tại. Khi gặp giới hạn/lỗi giữa chừng, báo lỗi riêng cho nguồn đó.
- Phân trang Sapo không tạo snapshot; nếu danh mục thay đổi khi quét, dòng có thể lặp/sót. Không dùng kết quả quét này để quyết định cập nhật hàng loạt. Biến thể không có quản lý tồn kho trả `onHand: null`.
- Không retry tự động; timeout 15 giây/request, không theo redirect. Lỗi API không trả raw response chứa khóa.
- Exit 0: nguồn được yêu cầu đã trả kết quả mà không báo lỗi/scan chưa hoàn tất; exit 2: có nguồn lỗi hoặc scan chưa hoàn tất; exit 1: tham số/file cấu hình không hợp lệ. `--status` không phải health check.
- `--source all` hiện vẫn báo lỗi riêng Sapo POS đến khi có tài liệu và triển khai adapter; kết quả Kiot/Web thành công vẫn được giữ.

## Tài liệu chính thức đã đối chiếu
- [KiotViet Public API](https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-ket-noi-api/public-api/): OAuth client credentials, products, phân trang.
- [Sapo Web GET Product](https://support.sapo.vn/phuong-thuc-get-cua-product): products.json, query theo tên, page/limit.
- [Sapo Web OAuth](https://support.sapo.vn/oauth): X-Sapo-Access-Token.
- [Sapo Web private apps](https://support.sapo.vn/ung-dung-rieng-private-apps): Basic Authentication với API key/secret và quyền chỉ đọc.

Đã chạy 46 kiểm thử cục bộ. Live tìm tên “Chanel” thành công trên cả Kiot/Web, còn trang tiếp theo; không coi số dòng trang đầu là toàn bộ danh mục. Chưa triển khai Sapo POS; không dùng tài liệu Web để suy đoán POS. Xem `tasks/TASK-006-live.json` cho kết quả kiểm tra SKU Kiot thực tế. Không ghi giá hoặc sửa sản phẩm trong kiểm chứng này.

## Chi tiết sản phẩm cho website (TASK-025)

Website gọi trực tiếp `createProductSearch` từ server qua `GET /api/catalog/search`, dùng lại `loadConnectionConfig` với `BossTele/.env`. Chỉ đọc KiotViet và Sapo Web; không gọi Sapo POS. Instance được giữ lại để tái sử dụng token Kiot, kết quả tìm kiếm không cache.

`search({ source, kind, query, page, detail: true })` thêm `detail` cho từng dòng sản phẩm. Bỏ `detail` thì cấu trúc dòng cũ được giữ nguyên. Dữ liệu chi tiết lấy từ response sản phẩm hiện có, chỉ copy các field được cho phép; giá trị thiếu là `null` hoặc mảng rỗng. Ảnh chỉ chấp nhận URL HTTPS, loại URL có tài khoản/mật khẩu và loại trùng.

- Kiot: tên, danh mục, thương hiệu, đơn vị, cân nặng, mô tả, ảnh, thuộc tính, trạng thái, liên kết biến thể, ngày tạo/cập nhật và tồn theo chi nhánh (gồm giá vốn).
- Sapo Web: tên sản phẩm/biến thể, vendor, loại, tags, mô tả, ảnh biến thể trước ảnh sản phẩm, options, barcode, giá so sánh, cân nặng, quản lý tồn, ngày tạo/cập nhật/đăng và alias.
- Thư viện nội bộ có thể trả `detail.inventories[].cost`; API website phải xóa khóa này trước khi trả cho người thiếu quyền `products.cost`. ADMIN có quyền mặc định; MANAGER và STAFF không có mặc định.
- Phân trang SKU Sapo dùng `startPage`/`nextPage`, giữ `warning` khi chưa quét hết; không kết luận không tồn tại chỉ từ một lượt quét bị giới hạn.
