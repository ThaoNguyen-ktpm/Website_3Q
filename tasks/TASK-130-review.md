Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-130 — Review của Claude

- Nội dung: Gắn Điều hành V2 vào web 8787, sau đăng nhập, chỉ Admin
- Kết luận: **`verified`** (giới hạn ở dưới)
- Ngày: 03/11/2026

## Đã xem

- `server/src/routes/v2Routes.ts`: `requireAuth`, `requireSameOrigin`, chỉ `ADMIN`; CSP riêng; `no-store`; snapshot đọc từ đường dẫn cố định `server/data/v2/kpi-snapshot.json` (gitignore), thiếu thì trả 404.
- 10 file runtime V2 trong `server/src/v2/mockup/`. Nguồn: `du-lieu` nhánh `v2-dashboard-20261102`, commit `224f2af`. 9 module/CSS khớp SHA-256 nguồn.
- Lần đầu: `changes_requested` vì test frontend nạp `demo-data.json` thiếu `with {type:'json'}`. Codex sửa ở `simulated-api.ts:2`; lần chạy lại đạt.

## Giới hạn

- Claude chưa xem V2 bằng tài khoản Admin trên trình duyệt. Bảo đã mở được `localhost:8787/v2/mockup/baoq-mockup-v2.html#view=dashboard` (ảnh 03/11). Phiên "Sửa trợ lý web…" đã kiểm tra giao diện ở TASK-133/136.
- Sao lưu trước khi sửa: `D:\Website_3Q_backup_20261103`.

## Bằng chứng (Claude chạy, 03/11/2026 ~14:20, trên code hiện tại gồm cả TASK-131…136 của phiên khác)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | shared 28, frontend unit 6, server 490 đạt / 18 bỏ qua (E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| E2E `saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 112/112 (28 test đã chuyển sang `shared/` ở TASK-128) |
| `curl` chưa đăng nhập: `/v2/mockup/baoq-mockup-v2.html` và `/v2/mockup/kpi/snapshot.json` qua 8787 | 401 cả hai |
