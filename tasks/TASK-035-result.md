# TASK-035 — Kết quả: nhúng Sale AI vào trang quản trị

- Dự án: web (+ một dòng trong `D:\BaoQ-AI`). Trạng thái: done, Claude làm trực tiếp theo yêu cầu của Bảo (2026-10-19): "nhúng chức năng sale vào trang Website của tui để nó có thể chạy chung và chạy chung server hiện tại luôn, giữ nguyên chức năng của Sale AI và lịch sử nằm ở trong có nút bấm để xem lịch sử Sale AI".

## Thay đổi
- `client/src/admin/views/App.jsx`: mục menu "Sale AI" (sau Tìm kiếm, icon trend, quyền `sale.manage`); trang nhúng tool Sale AI `http://127.0.0.1:4310/?view=…&dataset=real` bằng iframe, nút "Bảng giá sale", "Lịch sử", "Mở tab riêng"; báo "Sale AI chưa chạy" + Thử lại khi không kết nối được. `styles.css`: khung iframe.
- `server/src/config/permissions.ts`: quyền `sale.manage` "Tính và cập nhật giá sale (Sale AI)"; Admin có sẵn, Quản lý/Nhân viên không mặc định.
- `client/vite.config.ts`: CSP thêm `frame-src`/`connect-src` `http://127.0.0.1:4310`.
- `scripts/dev.mjs`: `npm run dev` bật thêm Sale AI (`node server.js` tại `D:\BaoQ-AI`, đổi bằng `BAOQ_AI_DIR`); bỏ qua nếu Sale AI đang chạy sẵn, thiếu thư mục, hoặc `SALE_AI=0`; Sale AI lỗi không làm tắt web.
- `D:\BaoQ-AI\server.js`: `frame-ancestors 'none'` → `frame-ancestors http://localhost:5173 http://127.0.0.1:5173` (chỉ trang web cục bộ được nhúng; Sale AI vẫn chỉ nhận Host 127.0.0.1/localhost).
- `AGENTS.md`: ghi ngoại lệ đã duyệt: nhúng Sale AI cho người có `sale.manage`, ghi giá Kiot/Sapo chỉ qua các bước của Sale AI.

## Kiểm tra
- `npm run build` đạt; `npm test` web 27 file / 424 test đạt.
- Test riêng của Sale AI `node --test *.test.js` tại `D:\BaoQ-AI`: 210/210 đạt. (`npm test` của Sale AI còn quét `tools/caveman`, `tools/superpowers` bên thứ ba: 37 lỗi có sẵn, không liên quan.)
- Thật: `npm run dev` bật API 4000, web 5173, Sale AI 4310 (cả ba trả 200); header Sale AI có `frame-ancestors http://localhost:5173 …`; CSP web có `frame-src … http://127.0.0.1:4310`.
- Chưa xem trang Sale AI trong trình duyệt đã đăng nhập.

## Giới hạn
- Chỉ dùng được trên máy chạy Sale AI (Sale AI chỉ nghe 127.0.0.1); mở web từ máy khác sẽ báo Sale AI chưa chạy.
- iframe không đi qua đăng nhập web: ai dùng chính máy này vẫn mở được http://127.0.0.1:4310 như trước.
- Nếu Sale AI đang chạy từ shortcut cũ (bản chưa sửa header) thì trình duyệt chặn nhúng; tắt rồi để `npm run dev` bật lại, hoặc dùng nút Mở tab riêng.

## Cập nhật 19/10/2026 (Bảo: "bị giới hạn chiều dài, đồng bộ màu")
- Sale AI nhận `?embed=1` khi nằm trong web: tông tối tím của web (ghi đè biến màu trong `public/style.css`, chỉ khi nhúng), ẩn menu riêng, báo chiều cao và hộp thoại mở qua `postMessage` chỉ tới `localhost:5173`/`127.0.0.1:5173` (`public/app.js`). Mở tab riêng vẫn giao diện sáng cũ.
- Web giãn iframe theo chiều cao Sale AI báo (chỉ nhận tin từ `http://127.0.0.1:4310` và đúng iframe), cuộn tới khung khi Sale AI mở hộp thoại; hộp thoại nằm ở đầu khung.
- Kiểm tra: web build đạt; Sale AI `node --test *.test.js` 210/210; xem thật bằng trang thử tạm trên localhost:5173 (đã xóa): khung cao 1.825px theo nội dung, không thanh cuộn trong, bảng giá tông tối. Chưa thử mở hộp thoại cập nhật/lịch sử khi nhúng.
- 19/10/2026 (Bảo: "tắt dữ liệu mẫu, tắt thanh trượt, đồng bộ màu ô chọn"): khi nhúng, ẩn ô Nguồn dữ liệu (chỉ Kiot thật), ô chọn nền tối, `overflow:hidden` + `display:flow-root` cho body để không còn thanh cuộn trong khung và chiều cao đo đủ lề cuối. Xem thật bằng trang thử tạm (đã xóa): không còn ô nguồn, không thanh cuộn trong khung.
- 19/10/2026 (Bảo: "bỏ nút Mở tab riêng, chạy chung cổng hiện tại"): Sale AI phục vụ tại `/sale-ai/` trên chính cổng web. `server/src/routes/saleAiRoutes.ts` chuyển tiếp nguyên luồng tới `SALE_AI_URL` (mặc định http://127.0.0.1:4310) sau `requireAuth` + `requirePermission('sale.manage')` + `requireSameOrigin`, đặt trước `express.json`, không chuyển cookie phiên web; Sale AI tắt → 503 `SALE_AI_DOWN`. Vite proxy thêm `/sale-ai`; CSP web `frame-src 'self'` (bỏ 127.0.0.1:4310). Sale AI dùng đường dẫn tương đối (`index.html` 3 chỗ, `fetch` trong `app.js`) nên chạy được cả ở `/` lẫn `/sale-ai/`. Bỏ nút "Mở tab riêng".
- Kiểm tra: web build đạt, `npm test` 28 file / 428 test (thêm `saleAiProxy.test.ts` 4 test: 401/403, GET không kèm cookie, POST giữ nguyên body + chặn khác nguồn, 301 về dấu "/", 503 khi Sale AI tắt); Sale AI 210/210. Thật: `GET http://localhost:5173/sale-ai/api/status` chưa đăng nhập → 401; Sale AI riêng ở 4310 vẫn tải `style.css`/`app.js` 200. Chưa xem trang khi đã đăng nhập.
