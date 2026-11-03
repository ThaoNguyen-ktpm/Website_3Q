Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-132 — Review của Claude

- Nội dung: Đưa V2 vào khung Điều hành chính, chung menu với chức năng thật
- Kết luận: **`verified`** (giới hạn ở dưới)
- Ngày: 03/11/2026

## Đã xem

- Codex triển khai xong lúc 13:06 (`TASK-132-result.md`). Sau đó Bảo yêu cầu chỉnh tiếp ở phiên khác: TASK-133 (bỏ ô vai trò và nút demo), TASK-134 (logo), TASK-135 (`changes_requested`, thay bằng 136), TASK-136 (V2 chạy như trang thường, khung chi tiết phủ cửa sổ). TASK-133, 134, 136 đã `verified` ở phiên đó.
- Toàn bộ test trên code cuối cùng (gồm TASK-132 và các task trên) đạt như bảng dưới.

## Giới hạn

- Yêu cầu 4 (dấu tiếng Việt ở tiêu đề serif): Claude chưa tự chụp ảnh Windows kiểm tra. Ảnh `TASK-132-embed-windows-desktop.png` được nhắc trong `TASK-133-review.md`.

## Bằng chứng (Claude chạy, 03/11/2026 ~14:20, trên code hiện tại gồm cả TASK-131…136 của phiên khác)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | shared 28, frontend unit 6, server 490 đạt / 18 bỏ qua (E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| E2E `saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 112/112 (28 test đã chuyển sang `shared/` ở TASK-128) |
| `curl` chưa đăng nhập: `/v2/mockup/baoq-mockup-v2.html` và `/v2/mockup/kpi/snapshot.json` qua 8787 | 401 cả hai |
