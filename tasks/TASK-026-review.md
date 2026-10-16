# TASK-026 — Review: danh mục gộp, phân trang kiểu KiotViet, 5 sản phẩm/dòng

- Người review: Claude. Trạng thái: verified (code, build/test, dữ liệu thật qua store, giao diện với dữ liệu thật); thao tác qua phiên Google thật: chờ Bảo thử.

## Phát hiện và sửa
- Trung bình — Codex chưa làm mục "Bổ sung" (gộp đủ ảnh hai nguồn; mục này được thêm vào spec sau khi Codex đã chạy): `catalogStore.ts` chỉ lấy ảnh Sapo khi Kiot không có ảnh. Claude sửa `mergeCatalog`: nối ảnh Sapo sau ảnh Kiot, bỏ trùng URL; cập nhật comment tương ứng. Test vẫn đạt.
- Ảnh "Chưa có ảnh" Bảo thấy lúc 16:2x: trang đang chạy bản dở dang trong lúc Codex sửa (hot reload). Sau khi xong, dữ liệu thật có ảnh cho SP024830/SP024833 và 20/20 thẻ trang 1 tải ảnh được.

## Bằng chứng
- `npm run build`: đạt. `npm test` gốc: 12 file, 264/264 đạt. `npm test` BossTele: 74/74 đạt.
- Store thật (chỉ đọc): danh mục gộp 5.639–5.640 sản phẩm, một lượt đồng bộ ~48 giây. `SP000094` → 1 kết quả "Soft Trunk Lv Của Nguyên", nguồn KiotViet + Sapo, 2 ảnh (Kiot + Sapo).
- Giao diện 1440px (dữ liệu thật của store, phiên giả lập chỉ ở trình duyệt): ô tìm không icon, không chip kiểu/nguồn, không nhóm nguồn; lưới 5 cột; dòng "Đồng bộ lúc 16:31 · 5.640 sản phẩm" + "Đồng bộ lại"; phân trang "Hiển thị [15/20/30/50/100 dòng]", ⏮ ◀ ô trang ▶ ⏭, "1 - 20 trong 5.640 hàng hóa"; drawer SP000094 có "Có trên: KiotViet, Sapo", 2 ảnh, tồn chi nhánh + giá vốn (người có quyền), link web Sapo.

## Còn lại (thấp)
- Drawer hiện vài trường kỹ thuật của Sapo: "Thuộc tính Title: Default Title", "Biến thể Default Title", "Bí danh", "Quản lý tồn bizweb" — nên ẩn giá trị "Default Title" và hai trường kỹ thuật.
- `tasks/TASK-025-ui-selfcheck.mjs` không còn đạt vì kiểm tra giao diện TASK-025 đã được thay thế (Codex ghi rõ, không sửa test cũ). Cần quyết định bỏ file này.
- Cache trong bộ nhớ một tiến trình: khởi động lại server thì lượt đầu chờ ~45–50 giây.

## Kết luận
verified, kèm các điểm thấp trên.

## Cập nhật (Bảo duyệt)
- Claude ẩn trường kỹ thuật Sapo trong drawer (`client/src/admin/views/App.jsx`): bỏ giá trị "Default Title" khỏi Thuộc tính/Biến thể, bỏ dòng "Bí danh" và "Quản lý tồn". Build đạt, 264/264 test, `TASK-026-ui-selfcheck` đạt; drawer SP000094 không còn ba mục này.

## Cập nhật 2 (Bảo yêu cầu: chỉ hiện sau khi tìm, ảnh lỗi, phân trang nhảy lên)
- `App.jsx` `CatalogSearch`: query rỗng → không gọi API, hiện "Tìm sản phẩm — Nhập tên hoặc SKU rồi nhấn Tìm."; xóa từ khóa → xóa kết quả. Bỏ `scrollIntoView` khi đổi trang/đổi số dòng.
- "Ảnh lỗi": quét toàn danh mục — mọi ảnh thuộc 4 host đã có trong CSP, mẫu ảnh mỗi host trả 200 image/*, 63 sản phẩm không có ảnh ở cả hai nguồn. Nguyên nhân thấy "lỗi": `loading="lazy"` + ảnh Kiot ~200 KB → ô trống tối khi cuộn. `CatalogImage`: bỏ lazy, `decoding="async"`, nền nhấp nháy (`is-loading`) đến khi `onLoad`, ảnh hiện dần; `styles.css` thêm `catalog-pulse` (tắt theo `prefers-reduced-motion` sẵn có).
- `tasks/TASK-026-ui-selfcheck.mjs`: cập nhật vì hành vi đổi có chủ đích theo yêu cầu Bảo (không tải toàn danh mục khi mở; xóa từ khóa không tải lại) — thay khẳng định "tự đồng bộ khi mở" bằng "không gọi API trước khi tìm", thêm kiểm tra xóa từ khóa. Các khẳng định khác giữ nguyên.
- Bằng chứng: build đạt; `npm test` 264/264; selfcheck đạt; trình duyệt: mở trang 0 request danh mục, tìm "Chanel" ra lưới, bấm "Trang sau" giữ vị trí cuộn (1835 → 1772 px, không về đầu), 20/20 ảnh tải xong.

## Cập nhật 3 (Bảo: chỉ lấy KiotViet)
- Cảnh báo "Sapo: Không đồng bộ được nguồn" xuất hiện khi một lượt đồng bộ Sapo bị giới hạn tần suất (bucket 40 request; đồng bộ đủ cần 23 request, các lượt chạy chồng nhau vượt giới hạn). Chạy lại riêng thì Sapo trả đủ 5.619 dòng. Bảo chọn chỉ dùng KiotViet.
- `catalogStore.ts`: `createCatalogStore` nhận `sources` (mặc định hai nguồn để giữ test gộp); instance chạy thật dùng `sources: ['kiotviet']`; trạng thái chỉ báo nguồn đang bật nên không còn cảnh báo Sapo. `App.jsx`: chữ trên trang đổi thành "KiotViet".
- Bằng chứng: build đạt; 264/264 test; selfcheck server/UI đạt; store thật: 5.403 sản phẩm, `sources` chỉ có `kiotviet: ok`, `SP000094` vẫn tìm được.

## Cập nhật 4 (Bảo: phân biệt hàng Hot trend / hàng thường)
- Quy ước của Bảo: tên sản phẩm KiotViet có dấu "!" = Hot trend. Dữ liệu thật: 24/5.403 sản phẩm có "!" (9 ở cuối tên, 15 ở giữa, ví dụ `SP024492 … 5/10/2026 ! "-`).
- `App.jsx`: `isHotTrend(name)` + `CatalogTrend`; thẻ hiện nhãn "Hot trend" (badge tím) hoặc "Hàng thường" cạnh nhãn tồn; drawer thêm dòng "Phân loại". Tên giữ nguyên, không bỏ dấu "!". `styles.css`: `.catalog-tags`.
- Bằng chứng: build đạt; 264/264 test; selfcheck UI đạt; trình duyệt: hai thẻ mẫu hiện "Hot trend · Sắp hết · Tồn 1" và "Hàng thường · Sắp hết · Tồn 1".

## Cập nhật 5 (Bảo: làm lại menu tài khoản)
- `App.jsx` `Account`: nút trên topbar chỉ còn avatar + mũi tên; bảng mở ra có avatar lớn, họ tên đầy đủ, email, nhãn vai trò (+ "Admin chính" nếu có), nút "Đăng xuất" có icon chiếm hết chiều ngang. `styles.css`: khối `@scope` mới cho `.account-card`, `.account-tags`, `.account-signout`.
- Bằng chứng: build đạt; 264/264 test; trình duyệt (phiên giả lập) hiển thị đúng bảng mới.
- Ghi chú: `tasks/TASK-024-ui-selfcheck.mjs` đang lỗi (không thấy badge "Admin chính" trong bảng nhân viên) — lỗi này có sẵn trước các thay đổi hôm nay của Claude (đã chạy lại trên bản App.jsx trước đó, cùng lỗi); cần kiểm tra riêng.
- Sửa tiếp theo Bảo: bỏ hàng nhãn; vai trò ("Admin") hiện lại như cũ dưới họ tên, email ở dòng riêng; không hiện "Admin chính" (đúng yêu cầu Bảo lúc 14:01 ở phiên khác: "tắt cái admin chính này đi"). Badge "Admin chính" bảng Nhân viên được xóa có chủ đích theo yêu cầu đó — `tasks/TASK-024-ui-selfcheck.mjs` còn khẳng định badge nên đã lỗi thời.
- Bỏ câu lặp trên trang Tìm kiếm (Bảo): bỏ mô tả dưới "Tra cứu sản phẩm", bỏ dòng "Nhập tên hoặc SKU để tìm sản phẩm." khi chưa tìm, bỏ khối "Tìm sản phẩm / Nhập tên hoặc SKU rồi nhấn Tìm."; còn placeholder trong ô tìm. Selfcheck UI cập nhật khẳng định tương ứng; build đạt, 264/264 test.
- Nút "Đồng bộ lại" đổi tên thành "Tải lại sản phẩm API" (đang chạy: "Đang tải lại…") và chuyển lên cùng hàng tiêu đề "Tra cứu sản phẩm" (slot `PanelHeading`). Selfcheck UI cập nhật nhãn mới; build đạt, 264/264 test.
- Tiêu đề khung tìm thành "Tra cứu sản phẩm / Tải lại sản phẩm API" bên trái; "Tải lại sản phẩm API" là nút dạng chữ cùng cỡ tiêu đề, màu phụ, rê chuột chuyển tím (`.catalog-heading`, `.catalog-reload`). Build đạt, 264/264 test, selfcheck UI đạt.
