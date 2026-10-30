# TASK-110: Bỏ giao diện cũ 5173 (`Webstie/client`), chỉ giữ 8787 (`Webstie/frontend`)

- Dự án: web
- Người phụ trách: Codex (thực hiện), Claude (chạy test, kiểm trình duyệt, review)
- Trạng thái: `ready`
- Ngày giao: 30/10/2026. Bảo: "tui muốn bỏ nó ra, tui muốn phần web này thôi" (chỉ dùng 8787). Bảo chọn: **chuyển chức năng Tài liệu sang 8787 trước rồi mới bỏ 5173**.

## Đối chiếu chức năng (Claude đã kiểm)

| Chức năng ở 5173 (`client/src/admin/views/App.jsx`) | 8787 |
|---|---|
| Đăng nhập Google, link đăng nhập (`pages/LoginPage.tsx`) | có (`frontend/src/login.tsx`) |
| Tìm kiếm sản phẩm, Sale AI | có (`price-system.tsx`) |
| Nhân viên, Nhật ký | có (`staff.tsx`, Điều hành) |
| Trợ lý BaoQ, nút Telegram (`AssistantWidget.jsx`) | có (`assistant.tsx`) |
| Tổng quan, Đơn hàng, Sản phẩm, Khách hàng, Cài đặt | **chỉ dữ liệu mẫu** (`admin/models/storeModel.js`), bỏ |
| **Tài liệu** (`admin/views/Documents.jsx`, API `/api/documents`): danh sách, tải lên, xoá, hỏi đáp theo tài liệu | **chưa có**, phải làm (phần A) |
| Mô hình túi 3D (`client/src/three`, `bag-preview.tsx`, `render-4k.ts`) | không dùng trong vận hành, bỏ |

## Phần A: mục "Tài liệu" trong 8787 (làm trước)

1. Viết trang "Tài liệu" bằng React/TS theo kiểu giao diện 8787 (`ui.tsx`, `app-v2.css`, dạng bảng giống `staff.tsx`). Chức năng tương đương `client/src/admin/views/Documents.jsx`:
   - danh sách tài liệu;
   - tải lên (giữ giới hạn loại và kích thước file như API đang kiểm);
   - xoá;
   - ô hỏi đáp theo tài liệu, hiện câu trả lời và nguồn.
2. Gọi đúng API hiện có: `client/src/api/documents.ts`. Chép hoặc chuyển sang `frontend/src/api/`. Không đổi API máy chủ.
3. **Quyền:** giống hệt cách 5173 quyết định `canManage` và ai được xem. Xem `client/src/admin/views/App.jsx` và `server/src/routes/documentRoutes.ts`. Không có quyền thì không thấy mục, như các mục khác của 8787 (`access.ts`).
4. **Vị trí:** ứng dụng "Điều hành", nhóm "Quản lý", dưới "Nhân viên" và "Nhật ký": mục "Tài liệu", tag THẬT. Code chỉ tải khi đã đăng nhập, như `workspace.tsx` (lazy).
5. Test đơn vị cho phần gọi API và phân quyền, nếu frontend có bộ test. Không có thì ghi lại.

## Phần B: bỏ `Webstie/client` và mọi chỗ phụ thuộc

1. Xoá thư mục `Webstie/client` (`git rm -r`, không commit).
2. `Webstie/package.json`:
   - bỏ `client` khỏi `workspaces`;
   - `build` và `test` thay `client` bằng `frontend` nếu frontend chưa nằm trong build/test gốc. Bản kiểm tra code (AUDIT 30/10) ghi frontend chưa có trong build/test gốc: đưa vào, gồm `tsc` và `vite build` của frontend.
3. `scripts/dev.mjs`: không chạy `client` nữa; giữ server, frontend (8787), BossTele.
4. **Địa chỉ chính:** `server/src/config/env.ts:8` đang mặc định `APP_ORIGIN = http://localhost:5173`. Đổi mặc định sang `http://localhost:8787`. Kiểm `config/origins.ts` và `EXTRA_ORIGINS`: 8787 thành địa chỉ chính; LAN (IP:8787) vẫn đăng nhập được như hiện nay.
   - Kiểm cách đăng nhập Google lấy địa chỉ (origin, redirect). Ghi rõ trong kết quả: Google Cloud Console cần có `http://localhost:8787` (và có cần IP LAN không). **Không đoán**; không sửa cấu hình Google.
   - Link đăng nhập (`staffService.loginLink`) phải tạo link 8787.
5. Sửa mọi chỗ còn nhắc 5173 hoặc `client/`:
   - CSP, cấu hình Vite;
   - `scripts/mac-forward.py` (cổng 5173 thành 8787);
   - `deploy/` (Caddyfile, nếu đang phát `client/dist` thì đổi sang `frontend/dist`);
   - `docs/LAN.md`, `docs/SECURITY.md`, `docs/DEPLOY.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `tasks/README.md`;
   - test máy chủ đang dùng origin 5173.

   Tìm bằng `git grep -n "5173\|client/"`, trừ lịch sử trong `tasks/`.
6. Không đụng: `server/src/sale-ai/` (trừ origin nếu cần), BossTele, dữ liệu `server/data/`.

## Nghiệm thu (Claude chạy)

- `npm run build` và `npm test` tại `Webstie`: đạt, có frontend.
- `npm test` tại `Webstie/BossTele`: đạt.
- `npm run dev`: chỉ còn 4000, 8787 (và bot). Không còn 5173.
- 8787:
  - đăng nhập Google và link đăng nhập chạy;
  - Admin thấy "Tài liệu", xem danh sách, hỏi đáp được;
  - người không có quyền không thấy mục, gọi API bị 403;
  - LAN `http://<IP>:8787` vẫn mở và đăng nhập được.
- `git grep -n "5173"` không còn trong code chạy và tài liệu hiện hành.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn (spawn EPERM) thì ghi lại, không xin quyền.
- Không dừng hay khởi động lại server đang chạy; Claude sẽ khởi động lại khi kiểm. Không đổi thay đổi chưa commit của task khác. Không commit. Không in khoá.
- Ghi `tasks/TASK-110-result.md`: danh sách file đổi/xoá; việc cần làm trên Google Console (nếu có); kết quả lệnh.
