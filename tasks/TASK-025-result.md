# TASK-025 — Tìm kiếm sản phẩm KiotViet và Sapo Web

- Dự án: web + BossTele.
- Người triển khai: Codex.
- Trạng thái: `ready_for_review` — đã triển khai; chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: thêm thư viện chi tiết, API/phân quyền, trang tìm kiếm/drawer; chạy kiểm tra cục bộ và tìm kiếm thật chỉ đọc ngày 2026-10-16.
- Bước tiếp theo: Claude chạy lại build/test ngoài giới hạn sandbox và kiểm tra HTTP có phiên đăng nhập, giao diện desktop/375px, ảnh/CSP trên trình duyệt.

## Thay đổi

1. `BossTele/lib/product-search.js`: tùy chọn `detail: true`, whitelist riêng Kiot/Sapo, chuẩn hóa số/null/mảng; HTTPS và loại ảnh trùng, ảnh biến thể Sapo trước ảnh sản phẩm. Không thêm endpoint. Không bật `detail` thì giữ nguyên cấu trúc dòng cũ.
2. `server/src/services/catalogSearchService.ts`: nạp CommonJS bằng `createRequire`, đường dẫn `BossTele` dùng được từ cả `src/services` và `dist/services`; khởi tạo search một lần và giữ token. Chỉ gọi KiotViet/Sapo Web song song; xử lý lỗi riêng từng nguồn và lỗi cấu hình bằng kết quả HTTP 200, thông báo không lộ bí mật. Không cache kết quả. Có injection config/search cho test.
3. `server/src/controllers/catalogController.ts`, `server/src/routes/catalogRoutes.ts`, `server/src/app.ts`: `GET /api/catalog/search`, bảo vệ bằng `requireAuth` + `products.view`, Zod kiểm tra query, lỗi 400 `VALIDATION_ERROR` bằng tiếng Việt, `Cache-Control: no-store`. Trang SKU Sapo được truyền thành `startPage`, giữ `nextPage` để tiếp tục lượt quét.
4. `server/src/config/permissions.ts`: thêm `products.cost`. ADMIN có mặc định; MANAGER/STAFF không có mặc định. Xóa khóa `cost` khỏi mọi inventory trước khi trả cho người thiếu quyền, không sửa dữ liệu gốc của lib.
5. `client/src/api/catalog.ts`: kiểu dữ liệu và hàm tìm kiếm có signal, cookie phiên và no-store.
6. `client/src/admin/views/App.jsx`: menu ngay sau Tổng quan, kiểm tra `products.view`, mô tả/footer dữ liệu trực tiếp; form Enter/nút Tìm, bộ lọc tên/SKU/nguồn. Có abort khi tìm mới/rời trang, bỏ phản hồi cũ, trạng thái chưa tìm/tải/rỗng/lỗi; nhóm nguồn độc lập, nối trang và thử lại đúng cursor kể cả trang SKU chưa có dòng nào. Thẻ là button; drawer gallery, số liệu, thông tin, tồn chi nhánh và giá vốn theo quyền. Mô tả strip HTML trước khi decode entities, không đưa markup nguồn vào DOMParser hoặc dùng dangerouslySetInnerHTML.
7. `client/src/admin/styles.css`: CSS trong `@scope (.admin-page)`, token hiện có, lưới 220px; ≤760px hai cột, ≤420px một cột; focus, ảnh lỗi/thiếu, skeleton và bảng tồn cuộn trong drawer. Không thêm gradient/blur/glow.
8. `client/vite.config.ts`: CSP chỉ thêm bốn host ảnh đã xác nhận thật bên dưới; không mở `https:` tổng quát.
9. `BossTele/docs/PRODUCT-SEARCH.md`: tài liệu tùy chọn chi tiết và website sử dụng lib.

## Test mới, giữ nguyên test cũ

- `BossTele/test/product-search-detail.test.js`: opt-in/default, whitelist, số/null, inventory/cost, ảnh HTTPS, thứ tự ảnh Sapo/options/tags, đường SKU không thêm endpoint.
- `server/src/tests/catalogSearch.test.ts`: 401/403, query sai, trim/default, quyền giá vốn, hai nguồn không POS, tái sử dụng instance, không mutate inventory gốc, lỗi cấu hình/nguồn và thiếu khóa, cursor SKU, quyền mặc định.
- `tasks/TASK-025-server-selfcheck.mjs`: kiểm tra bổ sung trên code server đã biên dịch, không DB/mạng, dùng khi Vitest không khởi chạy được.
- `tasks/TASK-025-ui-selfcheck.mjs`: SSR và thực thi handler thật với hook/fetch kiểm soát trong test: không tìm mỗi phím, abort/phản hồi cũ, retry từng nguồn, cursor, giữ nhóm còn lại, drawer, giá vốn và mô tả/ảnh an toàn. Fixture chỉ nằm trong kiểm thử, không có dữ liệu giả trong luồng sản phẩm.

## Lệnh và bằng chứng thực tế

- `npm.cmd run build --workspace server`: **đạt**, TypeScript exit 0.
- `node node_modules/typescript/bin/tsc -b client --pretty false`: **đạt**, exit 0.
- `node tasks/TASK-025-server-selfcheck.mjs`: **đạt**, exit 0. Bao gồm validation, singleton, cost stripping, hai nguồn độc lập, thiếu cấu hình, cursor và quyền mặc định. Không thay thế suite HTTP/Vitest.
- `node tasks/TASK-025-ui-selfcheck.mjs`: **đạt**, exit 0. Đây là kiểm tra cục bộ SSR/handler, không phải kiểm tra trình duyệt.
- Trong `BossTele/`: `node --test --test-isolation=none test/product-search-detail.test.js test/product-search.test.js test/chat.test.js test/connection-config.test.js test/telegram-product-guard.test.js`: **37/37 đạt**, 0 fail, exit 0. Giữ nguyên nội dung test cũ. Ba test detail mới đã được quan sát thất bại do chưa có `detail` trước khi triển khai, sau đó đạt; test bảo vệ DOMParser cũng đã được quan sát đỏ rồi xanh.
- `npm.cmd test` trong `BossTele/`: **bị sandbox chặn** `spawn EPERM` trước khi chạy test theo chế độ mặc định. Thử toàn bộ bằng `node --test --test-isolation=none test/*.test.js` vẫn có lỗi `spawnSync ... node.exe EPERM` ở test CLI cũ `add.test.js`; không sửa test hoặc logic không liên quan để né lỗi môi trường.
- `npm.cmd test` tại gốc: **bị sandbox chặn** Vitest fork worker `spawn EPERM`, không chạy được test. Thử `npm.cmd test --workspace server -- --pool=threads src/tests/catalogSearch.test.ts` cũng bị Vite `spawn EPERM` tại bước dò đường dẫn Windows. Không tuyên bố suite server đã đạt; test server mới chưa chạy được bằng Vitest.
- `npm.cmd run build` tại gốc: bước server TypeScript và client `tsc -b` qua; Vite bị chặn `spawn EPERM` khi khởi chạy esbuild để load config. **Build toàn dự án chưa đạt trong sandbox này.** Không sửa config/dependency để che lỗi.
- Detector Impeccable đã chạy trên App/CSS: có cảnh báo/advisory về font, màu, cỡ chữ, bo góc so với `DESIGN.md` vốn mô tả trang đăng nhập; admin hiện tại có hệ token khác. Giữ thiết kế admin theo spec, không đổi giao diện ngoài phạm vi hoặc sửa DESIGN.md để nới kiểm tra. Chưa đo computed style/contrast trên trình duyệt.
- `git diff --check`: **đạt** (cảnh báo chuyển LF/CRLF của Git không phải lỗi whitespace).
- Một lượt reviewer subagent chỉ đọc không phát hiện thêm lỗi sau sửa strip HTML và retry cursor; không thay thế review độc lập của Claude và không nâng trạng thái thành `verified`.

## Kiểm tra thật chỉ đọc và host ảnh

Không bị chặn mạng trong lần dò này. Gọi `createProductSearch(loadConnectionConfig())` với từng nguồn, `{ kind:'name', query:'Chanel', detail:true }`; chỉ in status/số dòng/hostname ảnh, không in khóa hoặc raw response.

- KiotViet: `status: ok`, trang đầu 100 dòng, ảnh từ `cdn2-retail-images.kiotviet.vn`, `cdn1-retail-images.kiotviet.vn`, `cdn-images.kiotviet.vn`.
- Sapo Web: `status: ok`, trang đầu 250 dòng, ảnh từ `bizweb.dktcdn.net`.
- Kiểm tra thêm `searchCatalog` từ `server/dist/services/catalogSearchService.js` với cùng từ khóa, `source:'all'`, `page:1`, `canViewCost:false`: cả hai nguồn `ok`, 100/250 dòng, `hasMore:true` ở cả hai, `containsCost:false` khi kiểm tra JSON. Đây là số dòng trang đầu, không phải tổng danh mục; lần này chưa qua route HTTP đăng nhập.
- CSP thêm đúng `https://cdn2-retail-images.kiotviet.vn`, `https://cdn1-retail-images.kiotviet.vn`, `https://cdn-images.kiotviet.vn`, `https://bizweb.dktcdn.net`. Nếu sản phẩm khác sử dụng host khác, Claude cần kiểm tra response thật rồi mới bổ sung host cụ thể.
- Mọi thao tác nguồn là GET ngoài POST OAuth token Kiot hiện có; không gửi request ghi sản phẩm/giá, không gọi Sapo POS.

## Phạm vi và giới hạn bàn giao

- Không cài package, không sửa DB/schema/migration/.env, không commit. Không sửa/nới/xóa test cũ; không sửa `/api/products`, trang sản phẩm mẫu, đăng nhập hoặc `PatternWaves.tsx`. Không thêm/đổi thư mục nên không có thay đổi bản đồ repo.
- `AGENTS.md` đã có sửa đổi và `tasks/TASK-025-spec.md` đã là file chưa tracked trước phiên này; giữ nguyên công việc đó.
- Chưa xác minh route thực tế với cookie phiên, bộ test Vitest, Vite bundle, tương tác browser/desktop/375px, tải ảnh và console CSP. Claude cần bổ sung các bước này trước nghiệm thu `verified`; self-check và live service read không được xem là bằng chứng cho các bước chưa chạy.
