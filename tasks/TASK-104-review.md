# TASK-104: Review của Claude

- Ngày: 30/10/2026
- Kết luận: **verified phần tự động**; còn chờ Bảo thử giao diện với phiên đăng nhập thật (mục "Còn lại").

## Phạm vi đã xem

- `TASK-104-result.md` (Codex, 30/10).
- Bản chép `Webstie/server/src/sale-ai/`: `core.js`, `runtime.ts`, `lib/` (thêm `retention.js`, `store-cleanup.js`; sửa `service.js`, `split-store.js`), `public/`, `test/`.
- `scripts/dev.mjs`: không còn tiến trình Sale AI riêng.
- `git grep`/tìm toàn `Webstie`: code chạy không còn `4310`, `SALE_AI_URL`, `BaoQ-AI`. Chỉ còn trong tài liệu BossTele và test cũ chép sang (`test/legacy-server.js`, `test/scripts/mac-launch.mjs`).

## Bằng chứng (Claude tự chạy, ngoài sandbox)

| Lệnh | Kết quả |
|---|---|
| `npm run build` tại `Webstie` | đạt (server tsc, client Vite) |
| `npm test` tại `Webstie`: vitest server | 454 pass, 14 skip (E2E cần cờ) |
| `npm test` tại `Webstie`: lõi Sale AI `node --test` | 276/276 pass |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` | 14/14 pass |
| `npm test` tại `Webstie/BossTele` | 137/137 pass |

Chạy thật sau khi khởi động lại `npm run dev` (tab "web Webstie dev"):
- Cổng mở: 4000, 5173, 8787. **Không còn 4310.**
- `GET /sale-ai/api/status` và `/sale-ai/` khi chưa đăng nhập: 401.
- Kho mới `server/data/sale-ai/` (`kiot-state.store`, `sapo-state.store`, `state.store`): 18KB, chưa tải Kiot. Đã gitignore.

## Lỗi và rủi ro

1. **Trung bình: web khựng khi Sale AI tạo bảng.** Codex đo trên dữ liệu mẫu: `/api/auth/me` tối đa 574ms (bản nguồn) và 1.681ms (bản dist) trong lúc "Kiểm thử". Vượt ngưỡng 300ms của spec. Codex đề xuất chuyển phần tạo bảng hoặc toàn bộ lõi sang `worker_threads`. **Cần task sau.** Tạm chấp nhận vì chỉ khựng vài giây lúc bấm "Kiểm thử".
2. **Nhẹ:** còn thư mục rỗng `server/src/sale-ai/data/` (spec yêu cầu xoá); không chứa dữ liệu.
3. **Nhẹ:** `BossTele/CLAUDE.md` và `BossTele/AGENTS.md` còn ghi "công thức Sale AI tại `D:\BaoQ-AI`". `sale-price.js` đã đọc chỗ mới, nhưng tài liệu cần sửa cho khớp.
4. Dung lượng thật chưa đo: kho mới chưa tải Kiot. Codex đo trên dữ liệu mẫu: ~14MB sau tải + kiểm thử, ~20MB sau cập nhật.

## Còn lại (Bảo thử)

- Đăng nhập Admin ở 8787 → Price System → Sale AI: "Tải lại từ Kiot" (chỉ đọc) → "Kiểm thử" → bảng hiện đúng quy tắc TASK-105; Lịch sử trống.
- Claude đo lại dung lượng `server/data/sale-ai` sau bước trên.
- `D:\BaoQ-AI` giữ nguyên, không chạy nữa. Lịch sử cũ ở `D:\BaoQ-AI\lich-su-cap-nhat-2026-10-29.json`.

Chưa commit.
