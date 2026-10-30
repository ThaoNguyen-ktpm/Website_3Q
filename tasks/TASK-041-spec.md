# TASK-041 — Codex kiểm tra lại code Claude tự viết cho trang Webstie (8787), 27–29/10/2026

- Dự án: web
- Người phụ trách: Codex (kiểm tra, sửa, test), Claude (review kết quả)
- Trạng thái: `ready`
- Hành động gần nhất, ngày 29/10/2026:
  - Bảo chọn "Quay lại đúng phân vai": Claude chỉ viết đặc tả và review, Codex viết code.
  - Ngày 27–29/10, Claude đã tự sửa code trực tiếp theo các yêu cầu Bảo giao trong chat. Code này chưa có Codex kiểm tra, chưa commit.
- Bước tiếp theo: Codex đọc diff, chạy kiểm tra, sửa lỗi nếu có, viết `TASK-041-result.md`. Claude review lại.

## Mục tiêu

Code Claude viết cho trang mới `Webstie/frontend` (cổng 8787) và phần máy chủ liên quan được Codex kiểm tra độc lập, có test cho phần logic, rồi mới commit.

## Phạm vi (diff chưa commit trong `D:\Website_3Q`)

Xem bằng `git status` và `git diff` tại `D:\Website_3Q`. Thuộc công việc này:

**Máy chủ (`Webstie/server`) và script chạy**
- `src/config/env.ts`: thêm `EXTRA_ORIGINS` (danh sách nguồn, cách nhau dấu phẩy).
- `src/config/origins.ts`: `allowedOrigin` nhận `APP_ORIGIN` và mọi `EXTRA_ORIGINS`, kể cả cùng cổng trên IP mạng nội bộ.
- `src/services/staffService.ts`, `src/controllers/staffController.ts`: link đăng nhập một lần mở đúng trang đã tạo ra nó (8787 hoặc 5173), dựa trên header `Origin` đã qua `allowedOrigin`.
- `src/tests/loginLink.test.ts`: thêm kiểm tra nguồn 8787.
- `scripts/dev.mjs`: đặt `EXTRA_ORIGINS=http://localhost:8787`, chạy thêm `npm run dev --prefix frontend`.

**Trang mới `Webstie/frontend`**
- `vite.config.ts` (mới): cổng 8787, `host: true`, proxy `/api` và `/sale-ai` về `127.0.0.1:4000`. `package.json`: thêm script `dev`.
- Đăng nhập: `auth.ts`, `login.tsx`. Khung đăng nhập nổi (Google + ô dán link/mã đăng nhập; ô dán link là **tạm thời**, Bảo sẽ bỏ sau).
- `main.tsx`: trang ngoài khi chưa đăng nhập chỉ hiện thông tin shop (showroom, hotline, giờ làm việc, website). Khu làm việc tải riêng sau khi đăng nhập (`lazy(() => import('./workspace'))`).
- `workspace.tsx` (tách từ `main.tsx`): trang chủ có ô ứng dụng và mục "Mở gần đây" (`localStorage` khoá `baoq-recent`), nút tài khoản, phân quyền.
- Trang thật: `price-system.tsx` (Sale AI nhúng iframe `&theme=walnut`, Tìm kiếm sản phẩm), `staff.tsx` (Nhân viên, Nhật ký), `sheet.tsx`, `band-action.tsx`, `apps.ts`, `api/` (chép `catalog.ts`, `staff.ts`, `audit.ts` từ `client/src/api`).
- `assistant.tsx`: Trợ lý BaoQ (gọi `/api/assistant/chat`) và nút BossTele (Telegram) chỉ cho `role === 'ADMIN'`.
- `app-header.tsx`, `dashboard.tsx`, `home.tsx`, `ui.tsx`, `policy.tsx`, `tasks.tsx`, `task-data.ts` (mới), `app-v2.css`: giao diện v3 đã duyệt, menu theo quyền, khung bên có nhãn THẬT.
- Đã xoá `i18n.tsx` và `glossary.ts` (bỏ nút VI/EN theo yêu cầu Bảo).
- `public/brand/baoq-wordmark.png`: logo chữ lấy từ `D:\HTML\assets\baoq-wordmark-bright-4k.png`.

**Khác**
- `Webstie/client/task-015-preview.html`: sửa đường dẫn `/@fs/...` sau khi dời code vào `Webstie/`.

**Không thuộc công việc này:** các thư mục skill chưa theo dõi (`.agents/skills/inventory-planner`, `review-reputation`, `social-content-engine` và bản sao trong `.claude/skills`, `Webstie/BossTele/.claude/skills`) — không do Claude tạo, để nguyên.

## Quy tắc phân quyền đã áp dụng (Bảo duyệt phương án A ngày 27/10)

| Khu | Trang | Quyền xem | Quyền thao tác |
|---|---|---|---|
| Price System | Sale AI | `sale.manage` | như quyền xem |
| | Tìm kiếm sản phẩm | `products.view` | giá vốn: `products.cost` (máy chủ tự bỏ cột) |
| Điều hành | Nhân viên | `staff.view` | thêm, sửa, tạo link: `staff.manage` |
| | Nhật ký | `audit.view` | — |
| | 5 trang Báo cáo demo + 5 trang Chưa kết nối | chỉ `role === 'ADMIN'` | — |
| Công việc, Chính sách | demo | mọi người đã đăng nhập | — |

- Người chỉ có một trang trong Price System (Quản lý, Nhân viên mặc định) thấy tên trang đó ("Tìm kiếm sản phẩm") thay cho "Price System" ở ô, menu và đường dẫn.
- Ô và mục menu Điều hành chỉ hiện khi người đó mở được ít nhất một trang trong khu.
- "Mở gần đây" chỉ liệt kê trang người đó có quyền.

## Tiêu chí nghiệm thu

1. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt (lần Claude chạy gần nhất: 438 test qua).
2. `npx tsc --noEmit` và `npx vite build` tại `Webstie/frontend` đạt.
3. Bản build: file JS công khai (`assets/index-*.js`) **không** chứa chữ của menu và trang nội bộ (ví dụ "Price System", "Nhật ký", "Chuẩn bị bộ ảnh", "TASK-DEMO"); các chữ này chỉ nằm trong chunk `workspace-*.js`.
4. Chưa đăng nhập: trang ngoài không có danh sách việc; mở `#page=overview`, `#page=team`… thì khung đăng nhập nổi lên; đóng khung thì về `#page=portal`.
5. Phân quyền đúng bảng trên với 3 vai trò mặc định (Admin, Quản lý, Nhân viên). Máy chủ vẫn trả 401/403 cho API khi thiếu quyền (không chỉ ẩn ở giao diện).
6. Link đăng nhập tạo từ 8787 mở 8787; tạo từ 5173 vẫn mở 5173. Link dán sai báo lỗi rõ, nút Google vẫn còn.
7. Mở qua wifi `http://<IP>:8787`: trang chạy, `POST /api/auth/link` với `Origin: http://<IP>:8787` qua được kiểm tra nguồn.
8. Nút BossTele chỉ hiện với Admin; Trợ lý gửi và nhận được câu trả lời khi đăng nhập thật.
9. Thêm test tự động cho phần logic mới không tầm thường. Đề xuất tối thiểu:
   - hàm quyết định trang được mở (`allowedPage` trong `workspace.tsx`) theo vai trò và quyền;
   - `linkCode` trong `login.tsx` (lấy `ma=` từ link, nhận mã trần, link không có mã).
   Nếu cần tách hàm ra file riêng để test được thì tách.

## Điểm Codex cần soi kỹ

- `workspace.tsx`: `useEffect` gọi `api('me')`/`demo/session` chỉ khi `admin`; dữ liệu demo không còn tải cho người không phải Admin.
- `main.tsx` `Root`: `blocked`, mở/đóng khung đăng nhập, trạng thái `user === undefined` lúc đang kiểm tra.
- `login.tsx`: ô dán link gọi `loginWithLink` trực tiếp; trạng thái `checking`; nút Google không bị gỡ khỏi DOM khi đang kiểm tra.
- `assistant.tsx`: huỷ yêu cầu khi đổi trang, thử lại, giới hạn 2000 ký tự.
- `origins.ts`: `env.EXTRA_ORIGINS ?? []` (20 test mock `env.js` không có khoá này).
- CSS `app-v2.css` có nhiều khối nối thêm theo từng lần chỉnh; gom lại nếu thấy trùng, không đổi giao diện đã duyệt.
- Dòng chữ tiếng Việt trong code là chữ hiện cho người dùng, giữ nguyên.

## Lệnh kiểm tra

```
cd D:\Website_3Q\Webstie
npm run build
npm test
cd frontend
npx tsc --noEmit
npx vite build --outDir <thư mục tạm>
```

## Vùng code

- **Điểm vào:** `Webstie/frontend/src/workspace.tsx` (`App`, `allowedPage`, `AppSide`, `Account`), `main.tsx` (`Root`, `PublicHome`), `login.tsx` (`Login`), `app-header.tsx` (`AppHeader`), `dashboard.tsx` (`OpsSide`, `OpsTabs`), `price-system.tsx`, `staff.tsx`, `assistant.tsx`; máy chủ `Webstie/server/src/config/origins.ts` (`allowedOrigin`), `services/staffService.ts` (`loginLink`).
- **Phạm vi ảnh hưởng:** `requireSameOrigin`, proxy `/sale-ai` (`saleAiRoutes.ts` dùng `allowedOrigin`), 20 test mock `config/env.js`; trang cũ `client/` (5173) phải giữ nguyên hành vi.
- **Test liên quan:** `Webstie/server/src/tests/loginLink.test.ts`; frontend chưa có bộ test chạy tự động (có `qa.spec.ts` Playwright cũ, chưa cập nhật).
- **Không đụng:** `Webstie/client` (trừ file preview đã nêu), `Webstie/BossTele`, `D:\BaoQ-AI` (có công việc riêng TASK-103 tại `D:\BaoQ-AI\tasks`).

## Giới hạn đã biết

- Claude chỉ thử giao diện bằng người dùng giả dựng trong trình duyệt (máy chủ trả 401 cho dữ liệu). Chưa thử với tài khoản thật, trừ đăng nhập Google ở 8787 Bảo đã làm được.
- Google Sign-In ở 8787 cần `http://localhost:8787` trong "Authorized JavaScript origins" của Google Cloud (Bảo tự thêm).
- Thông tin shop ở trang ngoài chép tay từ `D:\HTML\assets\app.js` (hotline, email, showroom, giờ làm việc, mạng xã hội).
