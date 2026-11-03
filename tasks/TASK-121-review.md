Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-121 — Review của Claude

- Kết luận: **`changes_requested`**
- Ngày: 02/11/2026
- Phạm vi đã xem:
  - `TASK-121-spec.md`, `TASK-121-result.md`;
  - diff `lib/kiot.js`, `runtime.ts`, `lib/service.js`, `public/app.js`;
  - chạy lại toàn bộ kiểm tra.

## Bằng chứng (Claude chạy, 02/11/2026 ~14:15–14:25)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | **lỗi**, ở `test:sale-ai` (3 test lõi bên dưới) |
| `node --test` lõi Sale AI | **369/372**, lỗi 3 |
| E2E `saleAiUpdateAll.test.ts` ×5 | 17/17 cả 5 lần |
| BossTele `npm test` | 140/140 |

## Lỗi

### Cao: GET bị đóng socket không còn được thử lại

- `test/kiot-errors.test.js:13`, "GET retries a closed socket once on a fresh connection; PUT never retries":

  ```
  Error: Kiot GET /products/1: không kết nối được mạng (NETWORK_ERROR)
  diagnostic: { code: 'NETWORK_ERROR', ..., attempts: 1 }
  ```

- `test/batch-update.test.js:32`, "closed socket on pre-write GET recovers through KiotClient…": nhận `preflight_failed`, mong đợi `success`.
- Spec yêu cầu 2: "GET được thử lại như hiện có". `lib/kiot.js` chỉ thử lại khi mã là `UND_ERR_SOCKET`/`ECONNRESET`. Lỗi socket đi qua transport mới (hoặc fetcher tiêm vào có dạng lỗi undici `cause.code`) bị gán `NETWORK_ERROR`, nên không thử lại.
- Cần sửa: GET bị đóng socket được thử lại đúng một lần, với cả lỗi từ transport `node:https` mới lẫn lỗi dạng undici của fetcher tiêm vào. PUT vẫn không bao giờ thử lại.

### Thấp: test cũ còn chờ header `Connection: close`

- `test/kiot-errors.test.js:28`: mong đợi `['close','close']`, nhận `['keep-alive','keep-alive']`.
- Bỏ `Connection: close` là thay đổi có chủ đích theo spec, nên chỉ sửa kỳ vọng của test. Phải giữ phần kiểm tra chính: GET thử lại trên socket mới và phục hồi được.

## Không phát hiện lỗi khác

- Transport `node:https`, timeout cả body, lưới an toàn fatal, phục hồi `ready` thành `not_sent`: khớp spec theo code đã đọc.
- Chưa kiểm được trên Kiot thật: Kiot đóng socket giữa PUT lô.


## Kiểm tra lại sau sửa (03/11/2026)

- Kết luận mới: **`verified`**.
- Hai lỗi "GET không thử lại" là báo nhầm: fetcher giả trong test kiểm header `Connection: close` trước, ném lỗi assertion rồi bị gói thành `NETWORK_ERROR`. Codex chỉ đổi kỳ vọng header (`undefined`, `keep-alive`), vẫn giữ kiểm tra thử lại GET và không gửi lại PUT. Claude đã đọc diff test.

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
