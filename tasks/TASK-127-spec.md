Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-127: Đưa giao diện web về chuẩn V2 (font, chữ, bố cục), giữ nguyên mọi chức năng

- Dự án: web (frontend)
- Người phụ trách: Codex (thực hiện phần còn lại), Claude (chạy test, review)
- Trạng thái: `ready`
- Hành động gần nhất:
  - 02/11/2026, Claude viết đặc tả theo yêu cầu và các lựa chọn Bảo đã chốt.
  - Bản đầu ghi nhầm vào `TASK-126-spec.md` và bị việc Sale AI TASK-126 ghi đè. Số đúng là TASK-127.
  - Cùng ngày, Bảo báo "bảng không đàng hoàng, font bị lỗi" và yêu cầu Claude sửa trực tiếp. Claude đã làm xong **font** và **bảng demo** (mục "Đã làm").
- Bước tiếp theo:
  - Codex làm Yêu cầu 2–3, ghi `TASK-127-result.md`. Không làm lại phần đã xong.
  - Claude review vào `TASK-127-review.md`.

## Yêu cầu của Bảo (02/11/2026)

"Cập nhật web của tui lên v2", lấy giao diện theo bản V2 mới trên GitHub (`baon102102-prog/du-lieu`, nhánh `v2-dashboard-20261102`, commit `224f2af`). Bảo đã chọn:

| Câu hỏi | Bảo chọn |
|---|---|
| Trang demo hiện có (Báo cáo Điều hành, Công việc, Chính sách, Sắp có) | **Giữ nguyên** |
| Màn V2 mới (KPI Sale, Hàng hóa & hiệu quả vốn, Tổng quan tùy chỉnh) | **Không thêm**, chỉ lấy giao diện |
| Font | **Font V2** |
| Ai làm | Claude viết đặc tả, Codex làm. Riêng font và bảng, Bảo nhờ Claude sửa luôn. |

5 mục THẬT (Sale AI, Tìm kiếm sản phẩm, Nhân viên, Nhật ký, Tài liệu) giữ nguyên chức năng, quyền và nhãn "THẬT".

## Nguồn chuẩn V2

Bản sạch ở `D:\Webstie-V2-nguyen-mau`, chỉ đọc.

- Quyết định chuẩn: `docs\developer-handoff.md`, mục **"Quyết định chuẩn giao diện V2 — 2026-10-31"**.
- Code mẫu: `docs\design-proposals\plan-mockup-v1\v2\mockup\src\baoq-mockup-v2.src.html` (CSS trong `<style>`, bảng ở `txView`/`inventoryView`/`costsView`), `docs\design-proposals\ops-modules-v2\app-v2-base.css`.
- Chạy xem mẫu: `docs\ban-giao-dev-20261101.md`, mục 3.

## Đã làm (Claude, 02/11/2026)

- **Font** (`frontend/src/app-v2-base.css:17-21`, `main.tsx`, `package.json`, `package-lock.json`):
  - Gỡ 6 import và 2 package `@fontsource` (Playfair Display, Be Vietnam Pro).
  - Serif: `"Baskerville","Palatino","Palatino Linotype","Georgia",serif`. Sans: `-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif` (đúng V2).
  - **Lệch có chủ đích so với V2:** thêm `"Palatino Linotype"` trước Georgia. Chromium Windows 11 không có Baskerville/Palatino nên rơi về Georgia. Georgia tách dấu chồng ("điề u", "kiế m"; đã chụp so sánh 6 font). Palatino Linotype giữ dấu đúng và cùng họ chữ Palatino của V2. **Không bỏ thứ tự này.**
- **Bảng demo** (`frontend/src/workspace.tsx`, bảng chung Thu–bán/Tồn kho/Kiểm tra/Chi phí):
  - Thiếu `className="table"` nên không ăn style V2; đã thêm.
  - Cột theo V2: Thu–bán (Mã, Ngày nghiệp vụ, Kênh, Sale, Số tiền, Giá vốn, Loại); Tồn kho (Mã, SKU, Tên, Tuổi tồn, Giá trị); Chi phí (Mã, Nhóm, Ngày, Số tiền). Kiểm tra giữ mọi cột hiện.
  - Ngày `dd/mm/yyyy`, Loại "Bán"/"Hoàn trả".
  - Dòng "N giao dịch, tổng X" (Tồn kho: "N SKU, tổng X") thay tiêu đề thẻ.
  - Bấm cả dòng mở chi tiết. Nút "Mở" giữ tên truy cập "Mở DEMO-xxx" cho `qa.spec.ts`.
- **Kiểm:**
  - `npm run build --prefix frontend` đạt; `npm test --prefix frontend` 3/3 đạt.
  - Trên :8787 (Vite dev): computed style đúng stack mới. Ảnh trang công khai cho thấy dấu đúng. Bảng V2 dựng thử bằng CSS app hiện đúng kiểu.
  - Chưa xem các trang sau đăng nhập: Claude không đăng nhập thay Bảo.
  - Chưa chạy `npm run build`/`npm test` gốc vì server đang có thay đổi chưa commit của việc khác (TASK-126 Sale AI).
  - `qa.spec.ts` chưa chạy: test còn dùng "Vai trò demo", không còn trên web có đăng nhập.

## Yêu cầu còn lại (Codex)

2. **Vai trò chữ V2.** Serif chỉ cho heading/display. Body, điều khiển, bảng, số tiền/KPI dùng sans, số `tabular-nums`. Kích thước:

   | Vai trò | Desktop | Mobile |
   |---|---|---|
   | HOME display | 44px / 400 / 1.08 | 26px |
   | Tiêu đề trang Điều hành | 32px / 400 / 1.08 | 24px |
   | Section title | 26px / 400 / 1.2 | 22px |
   | Body | 16px / 400 / 1.5 | |
   | KPI tiền | 28px / 600 / 1.15 | 18px |
   | KPI label / context | 14px / 13px | 12px |
   | Nút | 15px / 600, cao tối thiểu 44px | |
   | Bảng | 14px, header 500 | |
   | Sheet title / dialog title | 28px / 26px | |

3. **Đối chiếu từng màn hình** ở 1440, 768 và 390px:
   - Trang chủ công khai, đăng nhập, Trang chủ sau đăng nhập, menu drawer;
   - Sale AI, Tìm kiếm sản phẩm, Nhân viên, Nhật ký, Tài liệu, Trợ lý;
   - Báo cáo Điều hành demo, Công việc, Chính sách.

   Lệch V2 thì sửa CSS về V2:
   - spacing 4/8/12/16/20/24/32/40/56;
   - radius: control 6, panel 10, KPI 14, sheet/dialog 16;
   - overlay: sheet tối đa 460px, mobile đáy 92vh; dialog bản ghi tối đa 560px, max-height 80vh, padding 24, mobile max-height 88vh;
   - motion theo bảng V2.

   Ghi bảng trước/sau (selector, cũ, mới) vào result. Màn nào không lệch thì ghi "khớp".
4. **Không đổi:**
   - nội dung, nhãn THẬT/demo, route, quyền (`apps.ts`, `access.ts`), đăng nhập (`auth.ts`, `login-link.ts`), API (`src/api/`);
   - server, lõi Sale AI, BossTele, dữ liệu.
   - Không thêm màn V2 mới, thư viện hay hiệu ứng ngoài bảng motion V2.

## Ngoài phạm vi

- KPI Sale, Hàng hóa & hiệu quả vốn, Tổng quan tùy chỉnh.
- Sửa nghiệp vụ, dữ liệu, quyền.
- Commit vào `main`, push, deploy.

## Vùng code

- **Điểm vào:** `Webstie/frontend/src/app-v2-base.css` (token `:17-34`), `Webstie/frontend/src/app-v2.css`, `Webstie/frontend/src/workspace.tsx` (`COLS`/`cellText` và bảng demo).
- **Phạm vi ảnh hưởng:** `className` và inline style trong `staff.tsx`, `documents.tsx`, `price-system.tsx`, `login.tsx`, `assistant.tsx`, `home.tsx`, `workspace.tsx`, `app-header.tsx` (ví dụ `fontSize:14` ở drawer-top), `dashboard.tsx`, `policy.tsx`, `tasks.tsx`.
- **Test liên quan:** `frontend/qa.spec.ts` (đã lỗi thời, xem trên), `frontend/task041.spec.ts`, `frontend/*.unit.spec.ts`, `frontend/visual-capture.spec.ts` + `playwright.capture.config.ts` (`BAOQ_SHOTS`).
- **Không đụng:**
  - `Webstie/server/**`, `Webstie/BossTele/**`;
  - `frontend/src/apps.ts`, `access.ts`, `auth.ts`, `login-link.ts`, `src/api/**`, `simulated-api.ts`, `demo-data.json`;
  - thứ tự font serif đã chốt.
- Số dòng có thể lệch. Chạy lại `codegraph_explore` trước khi sửa.

## Test

- `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt. Không sửa hay nới test cũ; test đổi có chủ đích thì ghi lý do.
- Ảnh trước/sau ở 1440/768/390: `BAOQ_SHOTS=task-127-before` rồi `task-127-after`. Ảnh nằm ở `Webstie/docs/qa/<tên>`.
- Ghi computed style (`font-family`, `font-size`, `font-weight`) cho tiêu đề trang, section title, body, nút, KPI, bảng, sheet title.
- Chụp cận dấu tiếng Việt trên Chromium Windows: "Tổng quan điều hành", "Nhật ký", "Tìm kiếm sản phẩm", "Chào …, hôm nay mở gì?".

## Cách làm

- Codex chạy `-a never`. Làm trên nhánh/worktree riêng. Không commit vào `main`, không push.
- Không dừng hay khởi động lại server đang chạy ở 8787/4000. Không gọi Kiot/Sapo thật.

## Điểm còn cần quyết định

Không có.
