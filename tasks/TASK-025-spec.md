# TASK-025 — Mục "Tìm kiếm" trong admin: tra sản phẩm thật từ KiotViet + Sapo Web

- Dự án: web (`server/`, `client/`) + BossTele (`BossTele/lib`). Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16: thêm mục Tìm kiếm trong sidebar để tìm sản phẩm từ KiotViet và Sapo (API đã kết nối), hiện đầy đủ thông tin, bố cục đẹp. Bảo đã duyệt kế hoạch và ảnh demo.
- Áp dụng `AGENTS.md` mục "Quy tắc code": không cài gói, không sửa/nới test cũ (chỉ THÊM test), không xóa comment, xử lý lỗi đầy đủ, có kiểu. Không commit. Không sửa schema/migration/.env.
- Ngoại lệ kết nối thật (đã ghi trong `AGENTS.md`): website được ĐỌC sản phẩm KiotViet/Sapo Web. Chỉ đọc — không có request ghi tới Kiot/Sapo ngoài lấy token OAuth Kiot.

## Giả định (Bảo chưa chọn riêng — theo phương án đề xuất trong kế hoạch đã duyệt)
1. Khóa: server dùng lại `BossTele/.env` qua `loadConnectionConfig` (`BossTele/lib/connection-config.js:24`). Không chép khóa sang `server/.env`.
2. Giá vốn Kiot: thêm quyền `products.cost` ("Xem giá vốn"). ADMIN có (allPermissions); MANAGER/STAFF không có mặc định. Server KHÔNG gửi `cost` khi người dùng thiếu quyền.
3. Menu: "Tìm kiếm" ngay dưới "Tổng quan", icon `search`, quyền xem `products.view`.
4. Sapo POS ngoài phạm vi; UI chỉ KiotViet và Sapo Web.

## Vùng code
- Điểm vào: `BossTele/lib/product-search.js` (`kiotRow:81`, `sapoRows:92`, `searchOne:124`, `search:165`); `server/src/app.ts:35`; `client/src/admin/views/App.jsx:11` (nav), `:23` (quyền theo trang), `:40-48` (tiêu đề, render trang, footer), `Team:85` (mẫu component gọi API), `Drawer`.
- Thêm mới: `server/src/services/catalogSearchService.ts`, `server/src/controllers/catalogController.ts`, `server/src/routes/catalogRoutes.ts`, `client/src/api/catalog.ts`, `server/src/tests/catalogSearch.test.ts`, test BossTele mới (file mới, ví dụ `BossTele/test/product-search-detail.test.js`).
- Sửa: `server/src/config/permissions.ts`, `client/vite.config.ts` (CSP `img-src`), `client/src/admin/styles.css`, `BossTele/docs/PRODUCT-SEARCH.md`.
- Phạm vi ảnh hưởng: `createProductSearch` có caller `search-products.js`, `chat.js`, `lib/chat-session.js`, tests → `detail` là tùy chọn, mặc định output y như cũ. `permissions.ts` → `permissionService`, `staffService`, danh mục quyền trong UI nhân viên.
- Test liên quan: `BossTele/test/product-search.test.js`, `chat.test.js`; `server/src/tests/security.test.ts`, `staff.test.ts` (danh mục quyền) — phải vẫn đạt, không sửa.
- Không đụng: trang Sản phẩm dữ liệu mẫu, `/api/products` (Prisma), đăng nhập, `PatternWaves.tsx`, schema/migration.

## Yêu cầu

### 1. BossTele lib — tùy chọn `detail`
- `search({ ..., detail: true })` → mỗi row thêm object `detail`. Không truyền `detail` → row giống hệt hiện tại.
- Kiot `detail` (whitelist, giá trị thiếu → `null` hoặc `[]`): `name`, `fullName`, `categoryName`, `tradeMarkName`, `unit`, `weight`, `description`, `images[]` (chỉ chuỗi URL `https:`), `attributes[{name,value}]` (từ `attributeName`/`attributeValue`), `isActive`, `allowsSale`, `hasVariants`, `masterProductId`, `createdDate`, `modifiedDate`, `inventories[{branchId, branchName, onHand, reserved, cost}]`. Dùng response hiện có (list `includeInventory=true`, SKU `products/code/...`), không thêm endpoint mới.
- Sapo Web `detail`: `productName`, `variantTitle`, `vendor`, `productType`, `tags[]` (tách chuỗi theo dấu phẩy), `description` (từ `content` hoặc `body_html`), `images[]` (ảnh biến thể trước, rồi ảnh sản phẩm; chỉ `https:`; không trùng), `options[{name,value}]` (tên từ `product.options`, giá trị `variant.option1..3`), `barcode`, `compareAtPrice`, `weight`, `weightUnit`, `inventoryManagement`, `createdOn`, `modifiedOn`, `publishedOn`, `alias`.
- Chỉ copy field liệt kê; không trả raw response.

### 2. Server — `GET /api/catalog/search`
- `app.use('/api/catalog', requireAuth, requirePermission('products.view'), catalogRouter)` theo pattern route/controller/service hiện có.
- Query (zod): `q` trim 1–200 ký tự; `kind` = `name|sku` (mặc định `name`); `source` = `all|kiotviet|sapo-web` (mặc định `all` = chỉ hai nguồn này, không gọi POS); `page` số nguyên ≥ 1 (mặc định 1). Sai → 400 `VALIDATION_ERROR` tiếng Việt.
- Service: `createRequire(import.meta.url)` nạp `BossTele/lib/product-search.js` và `connection-config.js` bằng đường dẫn đúng cho cả `server/src/services` và `server/dist/services`. Tạo instance search một lần, dùng lại (giữ token Kiot). Lỗi đọc cấu hình → mỗi nguồn trả `status:'error'` + message, HTTP vẫn 200, không 500, không lộ khóa. Cho phép test thay lib/fetch (inject) để không gọi mạng.
- Gọi lib với `detail: true`; nguồn `all` → gọi lần lượt `kiotviet` và `sapo-web` (song song), không gọi `sapo-pos`.
- Người dùng thiếu `products.cost` → xóa khóa `cost` khỏi mọi `detail.inventories[]` trước khi trả.
- Response: `{ results: [{ source, status, items, page, hasMore, complete?, warning?, code?, message? }], canViewCost: boolean }`. Không cache.
- `permissions.ts`: thêm `'products.cost': 'Xem giá vốn'`; MANAGER và STAFF không có mặc định (ADMIN tự có).

### 3. Client — trang "Tìm kiếm" (giống ảnh demo đã duyệt)
- `nav`: `['search','search','Tìm kiếm']` ngay sau `overview`; quyền `search:'products.view'`; mô tả "Tra sản phẩm trực tiếp từ KiotViet và Sapo."; footer "Dữ liệu trực tiếp · KiotViet, Sapo".
- `client/src/api/catalog.ts`: `searchCatalog({q, kind, source, page}, signal)` theo kiểu `client/src/api/staff.ts`, có kiểu dữ liệu.
- Component `CatalogSearch` trong `App.jsx` (dùng `PanelHeading`, `Empty`, `Icon`, `money`, `c.setDrawer`):
  - Thanh tìm: ô nhập tự focus, nút "Tìm" (nút chính), chip "Theo tên / Theo SKU", chip nguồn "Tất cả nguồn / KiotViet / Sapo". Tìm khi Enter hoặc bấm "Tìm" — không gọi API mỗi phím. Hủy request cũ bằng `AbortController`.
  - Kết quả nhóm theo nguồn: tiêu đề nhóm = huy hiệu nguồn (KiotViet xanh dương, Sapo xanh lá theo màu badge sẵn có) + "N kết quả". Lưới thẻ: ảnh vuông `object-fit:cover` (placeholder icon khi không có ảnh hoặc ảnh lỗi), tên, SKU, giá bán, badge tồn: Còn hàng/Tồn N, Sắp hết (≤ `c.store.settings.lowStock`), Hết hàng (0), "Không quản lý tồn" (null).
  - Lỗi một nguồn → hiện trong nhóm đó, nhóm kia vẫn hiện. `hasMore` → thẻ "Xem thêm" nối trang tiếp. `warning` (SKU Sapo chưa quét hết) hiện dưới nhóm.
  - Bấm thẻ (thẻ là `button`, có focus) → Drawer `type:'catalog'`: gallery (ảnh lớn + thumbnail chọn được), tên + huy hiệu nguồn; 3 ô số: Giá bán (kèm giá so sánh gạch nếu có), Tồn tổng, Trạng thái (Đang bán/Ngừng bán); bảng thông tin: SKU, mã vạch, danh mục/loại, thương hiệu/vendor, đơn vị, cân nặng, thuộc tính/option, tags, ngày tạo/cập nhật (`vi-VN`); bảng "Tồn theo chi nhánh" (Kiot) — cột Giá vốn chỉ khi `canViewCost`; Mô tả dạng text thuần (strip HTML, không `dangerouslySetInnerHTML`). Field rỗng ẩn hẳn.
  - Trạng thái: chưa tìm (gợi ý nhập tên hoặc SKU), đang tải (thẻ skeleton), rỗng (`Empty`), lỗi request + nút "Thử lại".
- `client/src/admin/styles.css` trong `@scope (.admin-page)`, dùng token hiện có (`--surface`, `--surface-2`, `--border`, `--primary`, `--muted`, `--ink`): lưới `repeat(auto-fill,minmax(220px,1fr))`; thẻ hover/focus viền `--primary`; mobile ≤ 760px 2 cột, ≤ 420px 1 cột; drawer cuộn được. Không gradient/blur/glow mới. Tương phản chữ ≥ 4.5:1.
- `client/vite.config.ts` CSP `img-src`: thêm đúng host ảnh Kiot/Sapo lấy từ response thật (chạy CLI `node search-products.js --source all --name "Chanel"` ở BossTele hoặc tương đương, chỉ đọc). Không dùng `https:` tràn. Ghi host đã thêm vào result.

### 4. Tài liệu
- `BossTele/docs/PRODUCT-SEARCH.md`: ghi tùy chọn `detail` và việc website dùng lib này.

## Tiêu chí nghiệm thu
- Sidebar có "Tìm kiếm" ngay dưới "Tổng quan" khi có `products.view`; thiếu quyền → không có mục, API 403; chưa đăng nhập → 401.
- Tìm tên "Chanel" trả kết quả thật từ KiotViet và Sapo Web; drawer có ảnh và các nhóm thông tin; console không lỗi CSP ảnh.
- Thiếu `products.cost` → JSON không có `cost` (test).
- Một nguồn lỗi/thiếu khóa → nguồn đó báo lỗi, nguồn kia vẫn hiện (test).
- `createProductSearch` không `detail` → output giữ nguyên; test BossTele cũ đạt, không sửa.
- Không có request ghi tới Kiot/Sapo ngoài token OAuth Kiot.

## Lệnh kiểm tra
- `npm test` tại `D:\Website_3Q\BossTele`.
- `npm run build` và `npm test` tại `D:\Website_3Q`.
- Nếu sandbox chặn tiến trình con (`spawn EPERM`), ghi rõ trong result; Claude sẽ chạy lại.

## Kế hoạch
1. Codex: BossTele `detail` + test → server route/service/quyền + test → client trang + drawer + CSS + CSP → tài liệu. Ghi `tasks/TASK-025-result.md` (thay đổi, file, lệnh, kết quả thật, host ảnh đã thêm, giới hạn).
2. Claude review: đọc code, chạy build/test, gọi tìm kiếm thật (chỉ đọc), xem giao diện desktop + 375px → `tasks/TASK-025-review.md`.

## Điểm còn cần quyết định
- Nguồn khóa, quyền giá vốn, vị trí menu: đang theo giả định trên; Bảo có thể đổi sau review.
