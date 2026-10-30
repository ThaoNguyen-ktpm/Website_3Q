# TASK-111: Dọn code cũ còn sót sau TASK-104 và TASK-110

- Dự án: web + BossTele
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`
- Ngày giao: 30/10/2026. Bảo: "giao Codex dọn" sau khi Claude quét code cũ còn sót.

## Phạm vi (Claude đã quét; tham khảo thêm báo cáo `D:\Website_3Q\.claude\worktrees\codegraph-tools-inventory-c5ffc7\tasks\AUDIT-2026-10-30.md`, chỉ đọc)

1. **Sale AI nhúng còn nhắc cổng 5173:** `Webstie/server/src/sale-ai/public/app.js:11`, danh sách origin nhận `postMessage` có `http://localhost:5173`, `http://127.0.0.1:5173`. Bỏ hai origin này, giữ `location.origin`. Nếu cần nhận từ 8787 thì 8787 đã là cùng origin.
2. **Test Sale AI chạy trên bản chép cũ (AUDIT H1):** 10 file trong `server/src/sale-ai/test/` dựng máy chủ từ `test/legacy-server.js` (vỏ HTTP cũ của cổng 4310), không qua `core.js` thật.
   - Chuyển các test đó sang `core.js` / `createSaleAi` thật, giữ nguyên ý nghĩa từng test.
   - Xoá `test/legacy-server.js` và `test/scripts/mac-launch.mjs` (khởi động Mac cho cổng 4310).
   - Số test không được giảm vô lý; ghi bảng trước/sau.
3. **API sản phẩm SQLite không ai gọi:** `/api/products` (`server/src/app.ts:48`, `routes/productRoutes.ts`, `controllers/productController.ts` và service/model riêng của nó). Chỉ giao diện cũ 5173 gọi; 8787 không gọi (đã kiểm `frontend/src`).
   - Xoá route, controller, service và test riêng của API này.
   - **Không** đổi `prisma/schema.prisma` (`model Product`) và không tạo migration, để không mất dữ liệu. Ghi trong kết quả: bảng `Product` còn trong DB, chờ Bảo quyết.
   - Giữ quyền `products.view`, `products.cost` (catalog và trợ lý đang dùng).
4. **Model không dùng:** `server/src/models/userModel.ts` (AUDIT). Kiểm lại bằng `codegraph_explore` hoặc grep: không ai import thì xoá.
5. **Tài liệu BossTele còn trỏ `D:\BaoQ-AI`:** `BossTele/CLAUDE.md:9`, `BossTele/AGENTS.md:8`, `BossTele/docs/SALE-PRICE.md:3,8,51`.
   - Sửa sang chỗ mới: `server/src/sale-ai/lib/pricing.js`, kho `server/data/sale-ai/kiot-state.store`.
   - Ghi quy tắc giá hiện hành (TASK-105, TASK-109: trước 01/07 không giảm; 01/07–15/10 M1 từ 01/11; từ 16/10 như cũ).
6. **Thư mục rỗng hoặc thử nghiệm:** `server/src/sale-ai/data/` (rỗng), `scripts/.task020-test-*`. Xoá nếu rỗng hoặc chỉ là file thử nghiệm, không phải dữ liệu.
7. **Tìm thêm** code chỉ phục vụ giao diện cũ 5173 hoặc Sale AI cổng 4310 trong `server/src`, `frontend/src`, `scripts`, `BossTele` (không tính `.claude/skills`, `vendor`):
   - route, middleware, CSP, cấu hình chỉ cho 5173/4310;
   - `healthRoutes` **giữ** (dùng cho triển khai).
   Chỉ xoá khi có bằng chứng không ai dùng; ghi bằng chứng.

## Không làm trong task này

- `BossTele/vendor/claude-mem` (299MB): đã có ở TASK-042. Cần thao tác Git ngoài sandbox, Claude sẽ xử lý riêng.
- `Webstie/.task-110-client-backup/`: giữ tới khi Bảo xác nhận 8787 chạy ổn.
- `D:\BaoQ-AI`: lưu trữ, không đụng.
- `frontend/dist`, `server/dist`: sản phẩm build, tự sinh lại.
- Dữ liệu `server/data/`.

## Nghiệm thu (Claude chạy)

- `npm run build` và `npm test` tại `Webstie`: đạt. Test Sale AI chạy qua `core.js` thật, không còn `legacy-server.js`.
- `npm test` tại `Webstie/BossTele`: đạt.
- `git grep -n -E "5173|4310|BaoQ-AI|legacy-server|/api/products"` không còn trong code chạy và tài liệu hiện hành (trừ `tasks/` lịch sử và skill dùng chung).
- 8787 vẫn đăng nhập được, Sale AI và Tài liệu mở được (Claude kiểm sau khi khởi động lại).

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn (spawn EPERM, xoá file) thì ghi lại danh sách cần xoá trong kết quả, không xin quyền. Claude sẽ chạy test và xoá phần còn lại.
- Không dừng hay khởi động lại server. Không đổi thay đổi chưa commit của task khác. Không commit. Không in khoá.
- Ghi `tasks/TASK-111-result.md`: file xoá/sửa, bằng chứng "không ai dùng", bảng số test trước/sau.
