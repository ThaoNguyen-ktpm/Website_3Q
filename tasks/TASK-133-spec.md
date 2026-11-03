# TASK-133 — Bỏ ô "Vai trò demo" và nút "Dữ liệu demo" ở Điều hành V2

- Dự án: web
- Người giao: Claude · Người làm: Codex
- Trạng thái: `ready`
- Hành động gần nhất: Bảo yêu cầu ngày 03/11/2026, gửi kèm ảnh thanh trên cùng của Điều hành V2 ("tắt cái này đi"): ô chọn "Vai trò demo" (CEO) và nút "Dữ liệu demo".
- Bước tiếp theo: Codex triển khai **sau khi TASK-132 xong** (TASK-132 sửa cùng file V2 và `task041.spec.ts`), ghi `tasks/TASK-133-result.md`, đặt `ready_for_review`.
- Quan hệ: TASK-132 ghi "giữ … Vai trò demo và nhãn Dữ liệu demo" trong V2 nhúng; yêu cầu mới của Bảo (03/11/2026) thay điểm đó cho ô vai trò và nút Dữ liệu demo. Áp dụng cho cả bố cục mà TASK-132 tạo ra (nút đặt ở đầu nội dung); số dòng bên dưới lấy trước TASK-132, phải tìm lại.

## Mục tiêu
Trên mọi màn của Điều hành V2 (`/v2/`, cả khi nhúng trong frontend), không còn ô chọn "Vai trò demo" và nút "Dữ liệu demo" cùng đoạn ghi chú bật ra từ nút đó. Trang luôn hiển thị như vai trò CEO, tức như mặc định hiện nay.

## Phạm vi
- `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`:
  - Xoá phần tử `<label class="role-select">…<select id="role">…</label>` ở cả hai chỗ render: khối band trang chủ (khoảng dòng 846) và `bandControls()` (khoảng dòng 925).
  - Xoá nút `#demo-chip` (khoảng dòng 847 và 926) và đoạn `<p class="demo-note" id="demo-note">` (khoảng dòng 848 và 932).
  - Xoá nhánh `#demo-chip` trong bộ xử lý click (khoảng dòng 1339) và nhánh `e.target.id==='role'` trong bộ xử lý change (khoảng dòng 1354).
  - `store.role` giữ mặc định `'ceo'` (dòng 801). Không đổi `grants`/quyền theo vai trò trong file; chỉ không còn chỗ đổi vai trò.
  - Có thể xoá CSS `.chip-demo` và `.demo-note` nếu không còn chỗ dùng. **Không xoá `.role-select`**: ô "Kỳ dữ liệu" (`role-select period`, khoảng dòng 931) vẫn dùng class này.
  - Khi xoá thì gỡ hẳn khoá chữ `role`, `demo`, `demoNote` trong bảng chữ vi/en nếu không còn chỗ dùng. **Giữ** `demoData` và các nhãn "Dữ liệu demo" khác bên trong bảng/bản ghi.
- `Webstie/frontend/task041.spec.ts` (khoảng dòng 200 và 202): đổi hai kỳ vọng thành ô "Vai trò demo" và `#demo-chip` **không tồn tại** (`toHaveCount(0)`). Đây là thay đổi hành vi có chủ đích theo yêu cầu của Bảo; ghi lý do trong result.
- `Webstie/server/src/v2/README.md`: dòng "Thay đổi duy nhất trong HTML…" ghi thêm việc bỏ ô vai trò demo và nút Dữ liệu demo (TASK-133), để lần chép lại từ nguồn `du-lieu` không vô tình đưa chúng trở lại.

## Ngoài phạm vi
- Các nhãn demo khác giữ nguyên: menu "Báo cáo (demo)", "Chưa kết nối", "Khung demo" trong frontend; nhãn "Dữ liệu demo" trong bản ghi/bảng V2. Bảo chỉ yêu cầu bỏ hai điều khiển trong ảnh, và quy tắc dự án yêu cầu dữ liệu mẫu có nhãn trên giao diện.
- `Webstie/frontend/src/home.tsx`: cũng có `chip-demo` nhưng chỉ hiện khi chưa đăng nhập và nhận `roleControl`. Không đụng.
- `frontend/qa.spec.ts`, `frontend/visual-capture.spec.ts`: QA cũ chạy tay, không nằm trong `npm test`; không sửa trong task này, chỉ ghi vào result là hai file này còn gọi `getByLabel('Vai trò demo')`.
- Nguồn `docs/design-proposals/…` của repo `du-lieu`.

## Tiêu chí nghiệm thu
1. `grep -n "Vai trò demo\|id=\"role\"\|demo-chip\|demo-note" Webstie/server/src/v2/mockup/baoq-mockup-v2.html` không còn kết quả.
2. Mở `/v2/` đăng nhập Admin, cả trang Tổng quan, Thu–bán, Hàng hóa, KPI, Chính sách và bản nhúng trong frontend (`#page=v2-…`): thanh trên cùng không còn ô vai trò và nút Dữ liệu demo. Số liệu và các màn hiển thị như trước khi đổi (vai trò CEO). Ô "Kỳ dữ liệu" vẫn hiện như cũ. Console không có lỗi JS. Ghi ảnh chụp hoặc bằng chứng trình duyệt vào result.
3. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt; `dist/v2/mockup/baoq-mockup-v2.html` sau build là bản đã bỏ.
4. Chạy `npx playwright test task041.spec.ts` (cấu hình hiện có của file) nếu môi trường cho phép. Không chạy được thì ghi `blocked` cùng lý do, không thay bằng mô phỏng.

## Lệnh kiểm tra
```
cd D:\Website_3Q\Webstie && npm run build && npm test
```

## Vùng code
- **Điểm vào:** `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`: `store` (801), band trang chủ (846–848), `bandControls` (925–926), `demo-note` (932), click handler (1339), change handler (1354), CSS (87–93, 142), bảng chữ (695).
- **Phạm vi ảnh hưởng:** frontend nhúng V2 bằng iframe `?embed=1`. `scripts/copy-v2.mjs` chép file sang `dist/v2/mockup/` khi build server.
- **Test liên quan:** `Webstie/frontend/task041.spec.ts:200,202`.
- **Không đụng:** `frontend/src/**`, `server/src/v2/mockup/goods/**`, `server/src/v2/mockup/kpi/**`, TASK-131 và TASK-132 (đang làm song song ở `shared/`, BossTele, `server/src/services`).

## Điểm còn cần quyết định
Không có.
