# TASK-026 — Trang Tìm kiếm: danh mục gộp KiotViet + Sapo, phân trang kiểu KiotViet, 5 sản phẩm/dòng

- Dự án: web (`server/`, `client/`) + BossTele (`BossTele/lib`). Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo yêu cầu 2026-10-16 sau khi xem TASK-025: bỏ icon kính lúp trong ô tìm; chỉ hiển thị sản phẩm, không chia theo KiotViet/Sapo, đồng bộ sản phẩm hai nguồn; có phân trang hiển thị như KiotViet (ảnh mẫu: "Hiển thị [20 dòng ▾]" 15/20/30/50/100, nút đầu/trước/ô số trang/sau/cuối, "5,381 - 5,397 trong 5,397 hàng hóa"); lưới 5 sản phẩm một dòng.
- Bối cảnh: Bảo gõ `SP000094` khi đang ở "Theo tên" → 0 kết quả, tưởng API dữ liệu cũ. Claude đã kiểm tra: SKU này có trên cả KiotViet và Sapo ("Soft Trunk Lv Của Nguyên"). Nguyên nhân là chế độ tìm tách tên/SKU → bỏ tách.
- Áp dụng `AGENTS.md` mục "Quy tắc code": không cài gói, không sửa/nới/xóa test cũ (chỉ THÊM), không xóa comment, xử lý lỗi đầy đủ, có kiểu. Không commit. Không sửa schema/.env. Ngoại lệ chỉ đọc KiotViet/Sapo (TASK-025) giữ nguyên: chỉ GET + token OAuth Kiot.

## Giả định (Claude đề xuất, Bảo đổi được khi review)
1. Mở trang là thấy toàn bộ sản phẩm (đã gộp) theo trang; ô tìm lọc trên danh mục đó.
2. Gộp theo SKU (trim, không phân biệt hoa thường). KiotViet là nguồn chính (giá bán, tồn, giá vốn, danh mục, thương hiệu, tên); Sapo bổ sung ảnh khi Kiot không có ảnh, mô tả web, mã vạch, link web. Sản phẩm chỉ có ở một nguồn vẫn hiện. Sản phẩm không có SKU: không gộp, hiện riêng.
3. Thứ tự: mới nhất trước (ngày tạo, Kiot `createdDate` hoặc Sapo `createdOn`).
4. Đồng bộ: server tải toàn bộ hai nguồn vào bộ nhớ; tự làm mới khi dữ liệu quá 10 phút (vẫn trả dữ liệu cũ trong lúc làm mới); nút "Đồng bộ lại" ép làm mới, tối đa 1 lần/60 giây.

## Vùng code
- Điểm vào: `BossTele/lib/product-search.js` (`kiotRow`, `sapoRows`, `detail` từ TASK-025, `requestJson`, `kiotAuth`); `server/src/services/catalogSearchService.ts`, `controllers/catalogController.ts`, `routes/catalogRoutes.ts`; `client/src/admin/views/App.jsx` (`CatalogSearch`, drawer `type:'catalog'`); `client/src/api/catalog.ts`; `client/src/admin/styles.css` (khối catalog).
- Thêm mới: hàm lấy toàn bộ danh mục trong lib; service danh mục gộp (có thể là file mới `server/src/services/catalogStore.ts`); test mới cho lib, service, route, UI selfcheck.
- Giữ: endpoint `GET /api/catalog/search` và test của nó (không xóa); UI không dùng nữa thì xóa phần UI cũ không còn tham chiếu.
- Không đụng: trang Sản phẩm mẫu, `/api/products`, đăng nhập, PatternWaves, quyền (dùng lại `products.view`, `products.cost`).

## Yêu cầu

### 1. BossTele lib — tải toàn bộ danh mục
- Export hàm mới (ví dụ `createCatalogFetcher(config, fetchImpl)` → `fetchAll(source)`): KiotViet `GET /products?pageSize=100&currentItem=…&includeInventory=true&orderBy=createdDate&orderDirection=Desc` lặp đến hết `total`; Sapo Web `GET /admin/products.json?limit=250&page=n` lặp đến trang < 250. Dùng lại `kiotAuth`, `requestJson`, mapping `detail` (whitelist) đã có. Tuần tự, không retry tự động; giới hạn an toàn tối đa 200 trang/nguồn, vượt thì trả `complete:false`.
- Lỗi một nguồn → `{ source, status:'error', code, message, items: [] }`, không ném qua nguồn kia. `search()` hiện có giữ nguyên hành vi.

### 2. Server — danh mục gộp
- Store trong bộ nhớ: `{ items, syncedAt, syncing, sources: { kiotviet: {status, count, message?}, 'sapo-web': {...} } }`. Đồng bộ hai nguồn song song; nguồn lỗi giữ dữ liệu lần đồng bộ thành công trước của nguồn đó. Chỉ một lượt đồng bộ chạy cùng lúc (các request chờ chung một promise).
- Gộp theo SKU như giả định 2. Mỗi item gộp: `{ key, sku, name, price, onHand, image, images[], createdAt, sources: ('kiotviet'|'sapo-web')[], kiot?: detail, sapo?: detail }`.
- `GET /api/catalog/products?q=&page=&pageSize=` (sau `requireAuth` + `products.view`): `q` 0–200 ký tự, tìm chứa trong tên HOẶC SKU, không phân biệt hoa thường và không phân biệt dấu (bỏ dấu tiếng Việt, đ→d); `pageSize` ∈ {15,20,30,50,100}, mặc định 20; `page` ≥ 1 (vượt trang cuối → trả trang cuối). Response: `{ items, total, page, pageSize, pageCount, syncedAt, syncing, sources }`. Thiếu `products.cost` → bỏ `cost` khỏi `kiot.inventories`. Lần đầu chưa có dữ liệu → chờ lượt đồng bộ đầu rồi trả.
- `POST /api/catalog/sync` (`requireAuth` + `products.view`): ép đồng bộ; gọi trong 60 giây kể từ lần trước → 429 tiếng Việt kèm thời gian chờ. Trả trạng thái như trên (không kèm items).
- `Cache-Control: no-store`. Message lỗi không lộ khóa.

### 3. Client — trang Tìm kiếm mới
- Ô tìm: bỏ icon kính lúp bên trong ô; giữ nút "Tìm". Tìm khi Enter/bấm Tìm, hoặc tự tìm sau 400 ms ngừng gõ (đọc từ bộ nhớ server nên nhẹ). Bỏ chip "Theo tên/Theo SKU" và "Tất cả nguồn/KiotViet/Sapo". Đổi từ khóa → về trang 1.
- Dòng trạng thái nhỏ dưới ô tìm: "Đồng bộ lúc HH:mm · N sản phẩm" + nút "Đồng bộ lại" (đang chạy: "Đang đồng bộ…"); nguồn lỗi → một dòng cảnh báo ngắn nêu nguồn.
- Lưới: không nhóm, không tiêu đề nguồn trên thẻ; 5 thẻ/dòng ở màn ≥ 1280px, 4 ≥ 1024px, 3 ≥ 760px, 2 ≥ 420px, 1 dưới đó. Thẻ giữ như TASK-025 (ảnh vuông, tên, SKU, giá, badge tồn), bỏ huy hiệu nguồn.
- Phân trang dưới lưới, giống ảnh KiotViet: trái "Hiển thị [20 dòng ▾]" (select 15/20/30/50/100); giữa nút ⏮ ◀ ô nhập số trang ▶ ⏭ (Enter để nhảy; nút đầu/trước mờ ở trang 1, sau/cuối mờ ở trang cuối); phải "1 - 20 trong 5.397 hàng hóa" (số định dạng `vi-VN`). Đổi trang cuộn lên đầu lưới. Có `aria-label` tiếng Việt cho các nút.
- Drawer: giữ bố cục TASK-025, dữ liệu từ item gộp (ưu tiên Kiot, bổ sung Sapo); thêm dòng "Có trên: KiotViet, Sapo" trong bảng thông tin; ẩn "Cân nặng" khi bằng 0 hoặc null; tồn theo chi nhánh từ Kiot; mô tả: Kiot nếu có nội dung, thêm mô tả web Sapo (text thuần).
- Trạng thái: lần đầu đồng bộ ("Đang đồng bộ sản phẩm từ KiotViet và Sapo…" + skeleton), rỗng ("Không tìm thấy sản phẩm" + gợi ý), lỗi + "Thử lại".

## Tiêu chí nghiệm thu
- Ô tìm không còn icon kính lúp; không còn chip chọn kiểu/nguồn; không có nhóm KiotViet/Sapo.
- Mở trang thấy danh sách sản phẩm gộp có phân trang; tổng hàng hóa khớp số SKU gộp.
- Gõ `SP000094` → ra 1 sản phẩm "Soft Trunk Lv Của Nguyên", drawer ghi "Có trên: KiotViet, Sapo". Gõ "tui chanel" (không dấu) ra các túi Chanel.
- 5 thẻ/dòng ở 1440px; phân trang đổi số dòng, nhảy trang, đầu/cuối hoạt động; dòng "a - b trong N hàng hóa" đúng.
- Thiếu `products.cost` → không có `cost` trong JSON (test). Một nguồn lỗi → nguồn kia vẫn hiện, có cảnh báo.
- `search()` cũ và test cũ (BossTele, server) vẫn đạt, không sửa.

## Lệnh kiểm tra
- `npm test` tại `D:\Website_3Q\BossTele`; `npm run build` và `npm test` tại `D:\Website_3Q`.
- Sandbox chặn tiến trình con (`spawn EPERM`) → ghi rõ trong result; Claude chạy lại.

## Kế hoạch
1. Codex: lib `fetchAll` + test → store/gộp/route + test → client (ô tìm, lưới 5 cột, phân trang, drawer) + CSS → selfcheck UI. Ghi `tasks/TASK-026-result.md` (thay đổi, lệnh, kết quả thật, số sản phẩm mỗi nguồn và sau gộp, thời gian một lượt đồng bộ, giới hạn).
2. Claude review, chạy lại web, Bảo xem.

## Điểm còn cần quyết định
- Giả định 1–4 ở trên.

## Bổ sung (Bảo yêu cầu thêm, 2026-10-16)
- Ảnh: sản phẩm gộp lấy **đủ ảnh của cả hai nguồn** — ảnh KiotViet trước, rồi ảnh Sapo; bỏ ảnh trùng URL. `images[]` của item gộp và gallery trong drawer dùng danh sách này (không chỉ lấy Sapo khi Kiot thiếu ảnh). Ảnh đại diện trên thẻ = ảnh đầu tiên.
