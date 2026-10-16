# TASK-026 — Kết quả triển khai

- Dự án: web + BossTele. Người triển khai: Codex.
- Trạng thái: ready_for_review — code đã hoàn tất; chưa được Claude review TASK-026.
- Đặc tả: `tasks/TASK-026-spec.md`; giữ nguyên bốn giả định đã ghi trong đặc tả.
- Hành động gần nhất: hoàn tất triển khai, test/selfcheck, một lượt đọc nguồn thật và review kỹ thuật bổ sung; ghi giới hạn môi trường bên dưới.
- Bước tiếp theo: Claude chạy lại build/test chuẩn ngoài sandbox, kiểm tra HTTP bằng phiên đăng nhập và Bảo xem giao diện.

## Kế hoạch triển khai
1. Thêm `createCatalogFetcher(config, fetchImpl)` dùng lại OAuth, request và mapping whitelist; test phân trang, lỗi độc lập, giới hạn 200 trang, không retry. Giữ nguyên hành vi search cũ.
2. Thêm `catalogStore.ts`: cache từng nguồn, gộp SKU, lọc không dấu, phân trang, che cost, refresh chung promise, stale sau 10 phút và cooldown 60 giây. Thêm route products/sync trong lớp auth/quyền hiện có; test mới cho service và HTTP.
3. Cập nhật API client, CatalogSearch, drawer và CSS trong vùng catalog; selfcheck mới cho thao tác và dữ liệu drawer.
4. Chạy build, hai bộ test, selfcheck; đối chiếu hash test cũ. Ghi bằng chứng và giới hạn, bàn giao ready_for_review.

## Ràng buộc và trọng tâm kiểm tra
- Không cài gói, không sửa DB/schema/.env, không commit, không sửa/xóa/nới test cũ.
- Giữ dữ liệu TASK-025 và endpoint search cũ. Không thay phần đăng nhập, quyền, products mẫu.
- Kiểm tra nguồn lỗi sau thành công, nguồn trả thiếu trang, request đồng thời, cache không bị biến đổi khi che cost, response cũ không ghi đè truy vấn mới.
- Dữ liệu bên ngoài chỉ đi qua mapping whitelist; lỗi không đưa thông báo thô từ provider ra client; mô tả hiển thị text thuần.

## Thay đổi đã thực hiện
- `BossTele/lib/product-search.js`: thêm `createCatalogFetcher(config, fetchImpl)`, trả hàm `fetchAll(source)`; dùng chung OAuth Kiot được tách ra từ logic sẵn có. Kiot đọc từng trang 100, có inventory và thứ tự ngày tạo giảm dần; Sapo đọc từng trang 250 sản phẩm rồi map biến thể. Mỗi nguồn tuần tự, tối đa 200 trang, không retry; lỗi loại bỏ kết quả dở dang. `createProductSearch` giữ hành vi cũ.
- `server/src/services/catalogStore.ts` (mới): hai nguồn tải song song, một promise chung cho mỗi lượt; cache riêng từng nguồn, giữ nguồn đã thành công khi lần sau lỗi hoặc chưa tải hết. Lần đầu chưa từng hoàn tất được phép hiển thị phần tải được nhưng phải cảnh báo giới hạn. Store nằm trong bộ nhớ tiến trình, tự làm mới khi có GET sau 10 phút; GET trả dữ liệu cũ trong lúc làm mới, lần đầu chờ tải xong.
- Store gộp SKU trim/không phân biệt hoa thường; SKU trống dùng khóa nguồn + ID, không gộp chéo nguồn. Kiot ưu tiên tên/giá/tồn/ngày tạo/chi tiết thương mại; Sapo bổ sung ảnh thiếu và chi tiết web. Sắp xếp ngày tạo giảm dần, khóa ổn định khi cùng ngày; tìm chứa tên hoặc SKU không dấu, gồm đ→d.
- `server/src/controllers/catalogController.ts`, `server/src/routes/catalogRoutes.ts`: thêm GET `/api/catalog/products` và POST `/api/catalog/sync`, giữ GET `/search`. Tái sử dụng lớp `requireAuth` + `products.view` tại `app.ts`; không đổi quyền. GET kiểm tra query, phân trang/clamp; clone kết quả và bỏ cost trước khi trả nếu thiếu `products.cost`. POST cooldown 60 giây giữa các yêu cầu đồng bộ thủ công, kể cả yêu cầu đang chạy; trả 429 tiếng Việt có số giây chờ. Hai handler mới đặt `Cache-Control: no-store`, lỗi nguồn dùng thông báo cố định.
- Response GET có thêm `catalogTotal` (tổng danh mục gộp trước khi lọc) để dòng đồng bộ luôn báo đúng số sản phẩm; `total` vẫn là tổng khớp từ khóa để phân trang. POST chỉ trả trạng thái, không có items.
- `client/src/api/catalog.ts`: thêm kiểu và hàm GET danh mục/POST đồng bộ, giữ API search cũ.
- `client/src/admin/views/App.jsx`: bỏ icon trong ô tìm, bỏ chip kiểu/nguồn và nhóm nguồn; tự tải danh mục khi mở, tìm Enter/nút Tìm/400 ms; abort request cũ và bỏ response đến muộn; polling khi server đang làm mới. Có trạng thái đồng bộ, cảnh báo theo nguồn, lỗi/thử lại, skeleton, rỗng; thay phân trang bằng chọn 15/20/30/50/100 dòng, đầu/trước/ô trang/sau/cuối và dải số vi-VN. Nhập trang vượt giới hạn được clamp; đổi trang cuộn lên lưới.
- Drawer dùng dữ liệu gộp, ghi “Có trên: KiotViet, Sapo”, ẩn cân nặng 0/null, giữ tồn chi nhánh Kiot và bảo vệ giá vốn; tách mô tả Kiot/mô tả web thành text thuần. Có link Sapo từ domain HTTPS đã kiểm tra và alias hợp lệ, không chứa thông tin xác thực. Không mở link này trong lượt kiểm tra.
- `client/src/admin/styles.css`: chỉ sửa vùng catalog, dùng token/admin component hiện có; 1 cột dưới 420px, 2 từ 420px, 3 từ 760px, 4 từ 1024px, 5 từ 1280px. Không thêm thư mục nên bản đồ repo không cần đổi.
- Test mới: `BossTele/test/catalog-fetcher.test.js`, `server/src/tests/catalogStore.test.ts`, `server/src/tests/catalogProducts.test.ts`, `tasks/TASK-026-server-selfcheck.mjs`, `tasks/TASK-026-ui-selfcheck.mjs`. Thêm `tasks/TASK-026-live-selfcheck.mjs` để chạy lại lượt đọc thật mà không log sản phẩm chi tiết hay khóa.

Link web ghép từ domain Sapo đã cấu hình và alias, theo ví dụ đường dẫn `product.url` trong [tài liệu chính thức Sapo](https://support.sapo.vn/product-object). Chưa xác minh trang đích của từng link hoặc domain riêng của cửa hàng.

## Bằng chứng kiểm tra cục bộ
- TDD fetcher: test mới ban đầu thất bại vì chưa export `createCatalogFetcher`; sau triển khai đạt. Regression link web cũng chạy đỏ rồi xanh. Không sửa test search cũ.
- `node --test --test-isolation=none test/catalog-fetcher.test.js test/product-search.test.js test/product-search-detail.test.js` tại `BossTele`: **23/23 đạt** (7 test fetcher mới + 16 test search/detail có sẵn). Gồm OAuth cache, phân trang, giới hạn 200 trang, JSON thiếu/sai, danh mục rỗng, lỗi trang sau/429 không giữ phần dở dang và link alias an toàn.
- `node node_modules/typescript/bin/tsc -p server/tsconfig.json`: đạt, exit 0.
- `node node_modules/typescript/bin/tsc -b client`: đạt, exit 0.
- `node tasks/TASK-026-server-selfcheck.mjs`: đạt, exit 0. Kiểm tra gộp/SKU trống/thứ tự/tìm không dấu/phân trang, che cost không đổi cache, single-flight, stale refresh, giữ nguồn lỗi/chưa hoàn tất, cooldown và timestamp; gọi trực tiếp controller để kiểm tra parse/quyền cost/cache header và đăng ký route. Đây là selfcheck với request/response doubles, **không phải kiểm thử HTTP**.
- `node tasks/TASK-026-ui-selfcheck.mjs`: đạt, exit 0. Dùng JSX thật và React SSR/hook driver; kiểm tra trạng thái đầu, bỏ chip, drawer gộp/cost/text/zero weight/link, dải phân trang, nút đầu/cuối, nhập trang vượt giới hạn, debounce, hủy/bỏ response cũ, đổi pageSize và nút đồng bộ; regression tiếp tục polling sau GET lỗi. Chỉ kiểm tra khai báo breakpoint CSS, **không đo layout trình duyệt**.
- `node tasks/TASK-025-server-selfcheck.mjs`: vẫn đạt, exit 0.
- Đối chiếu SHA-256 trước/sau: **18 file test/selfcheck cũ không thay đổi**, gồm cả file TASK-025 chưa được git track. Không sửa, xóa hoặc nới test cũ.
- `git diff --check`: đạt, exit 0; Git chỉ nhắc chuẩn hóa LF→CRLF ở `BossTele/lib/product-search.js`.

## Kiểm tra nguồn thật (chỉ đọc)
Lệnh: `node tasks/TASK-026-live-selfcheck.mjs`, exit 0. Nguồn cấu hình: loader hiện có đọc `BossTele/.env`; không in/ghi khóa. Không truy cập DB, chỉ GET sản phẩm và POST OAuth Kiot.

- Snapshot hoàn tất: **2026-10-16T09:24:56.025Z** (16:24:56 giờ Việt Nam).
- KiotViet: status `ok`, **5.402** bản ghi.
- Sapo Web: status `ok`, **5.619** biến thể sau mapping.
- Danh mục gộp: **5.639** sản phẩm.
- Thời gian lượt kiểm tra: **41.898 ms**, khoảng **41,9 giây**.
- `SP000094`: **1** kết quả, tên đúng “Soft Trunk Lv Của Nguyên”, sources `kiotviet` + `sapo-web`.
- `tui chanel`: **241** kết quả khi tìm không dấu.
- Đây là kiểm tra trực tiếp qua store/fetcher, không đi qua HTTP/session thật hoặc trình duyệt. Số lượng có thể đổi theo dữ liệu nguồn.

## Các kiểm tra bị chặn và giới hạn
- `npm.cmd run build` tại gốc: server TypeScript và client TypeScript chạy xong; **Vite build bị `spawn EPERM`** khi khởi chạy esbuild để đọc config. Không ghi là build toàn bộ đạt.
- `npm.cmd test` tại gốc: **Vitest không tạo được forks worker (`spawn EPERM`)**, chưa thực thi test; thử `--pool=threads --maxWorkers=1` cũng bị Vite `optimizeSafeRealPathSync` chặn khi tạo tiến trình. Hai file Vitest mới và bộ test HTTP cũ cần Claude chạy lại ngoài sandbox.
- `npm.cmd test` tại `BossTele`: **Node test runner bị `spawn EPERM`**. Chạy toàn bộ với `--test-isolation=none` vẫn gặp `spawnSync ... EPERM` trong các test CLI của `add.test.js`; không sửa/bỏ các test đó. Bộ search/fetcher liên quan chạy riêng đạt như trên; không tuyên bố toàn bộ BossTele đạt.
- `node tasks/TASK-025-ui-selfcheck.mjs`: **không đạt** ở harness điều khiển UI cũ (`calls[0]` undefined). Harness cũ tắt toàn bộ effects và giả định gọi search submit-only/theo nguồn, còn TASK-026 tải danh mục bằng effect, tìm tự động và không dùng API search. Giữ nguyên file theo yêu cầu không sửa test cũ; selfcheck TASK-026 mới kiểm tra hành vi mới. Đây là giới hạn tương thích của selfcheck cũ, không ghi là nó vẫn đạt.
- Impeccable detector đã chạy một lần trên App/CSS: exit 1, chủ yếu cảnh báo font/màu/cỡ chữ/bo góc admin không khớp DESIGN.md vốn mô tả màn đăng nhập. Giữ thiết kế admin hiện có trong phạm vi TASK-026; chưa có kết luận visual QA.
- Công cụ trình duyệt **từ chối quyền quan sát `http://localhost:5173`** (origin approval bị từ chối). Không tìm đường vòng. Chưa xác minh bằng ảnh/DOM thật rằng ở 1440px có 5 cột, không tràn trên điện thoại, hay thao tác qua phiên Google thật.
- Cache chỉ ở một tiến trình; khởi động lại phải đồng bộ lại. Lượt đầu chờ API có thể mất hàng chục giây như đo ở trên. Không thêm lưu DB, không thêm cơ chế đồng bộ xuyên nhiều process.

## Review bổ sung và việc cần Claude xác nhận
- Agent review chỉ đọc phát hiện hai P2: cập nhật `syncedAt` khi cả hai nguồn lỗi; polling dừng sau một GET thất bại. Đã thêm regression chạy đỏ trước sửa, sửa logic rồi kiểm tra xanh. Reviewer chạy lại độc lập hai selfcheck và xác nhận không còn phát hiện trong hai bản sửa này. Đây không phải review Claude TASK-026.
- Claude chạy lại `npm.cmd run build`, `npm.cmd test` ở gốc và `npm.cmd test` trong `BossTele` ở môi trường cho phép tạo tiến trình con; kiểm tra hai endpoint HTTP với phiên/quyền thật. Sau đó Bảo kiểm tra desktop/mobile, phân trang và drawer.
- Không cài package, không sửa DB/schema/.env, không commit. Các thay đổi TASK-025 tồn tại trước phiên được bảo toàn; không sửa các phần ngoài phạm vi như quyền, đăng nhập, products mẫu và PatternWaves.
