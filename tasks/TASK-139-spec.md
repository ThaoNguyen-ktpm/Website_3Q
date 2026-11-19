Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-139: Tab "Duyệt" trong Sale AI — chặn giá sale thấp hơn giá vốn

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai/`, nhúng ở Price System của `Webstie/frontend`)
- Người giao: Claude · Người làm: Codex · Kiểm tra: Claude
- Trạng thái: `ready`. Làm trên nền TASK-137/138 (đã `verified`, chưa commit). Giữ nguyên các thay đổi đó.
- Hành động gần nhất: Bảo duyệt kế hoạch và giao diện demo ngày 10/11/2026 ("Làm cả hai").
- Bước tiếp theo: Codex triển khai, ghi `tasks/TASK-139-result.md`, đặt `ready_for_review`.

## Yêu cầu của Bảo (10/11/2026)

> "phát triển thêm tính năng đó là duyệt - sẽ thông báo những sản phẩm nào đang được giảm mà thấp hơn giá vốn tại đây sẽ có nút duyệt và nút duyệt tất cả điều kiện đó là bắt những sản phẩm mà được giảm qua khỏi giá vốn và ko cho tự động cập nhật tự động hay cập nhật tay bên auto - ko hiện thị bên bảng kia lun"

Bảo đã chốt khi xem demo:
- So **giá sale** (`price`, P_M) với giá vốn.
- Bấm Duyệt thì **ghi thẳng lên Kiot từ tab Duyệt**. Món không quay lại Bảng giá sale.
- Món **chưa có giá vốn**: không tính ngay từ đầu.
- 95 món đã lỡ ghi dưới vốn: hiện nhóm **"Đã lỡ giảm dưới vốn"** với 2 lựa chọn **Trả về giá vốn** / **Giữ giá** (từng món và tất cả).
- Thêm quy tắc **giá gốc ≤ giá vốn thì không giảm**.

Giao diện đã duyệt: ảnh chụp Claude dựng trên web thật, tab `Duyệt (102)` cạnh `Bảng giá sale | Lịch sử`. Nhóm trên là Chờ duyệt (bảng + nút "Duyệt tất cả (n món)" + nút "Duyệt" từng dòng). Nhóm dưới là "Đã lỡ giảm dưới vốn (95)" (nút "Trả về giá vốn tất cả" / "Giữ giá tất cả", từng dòng "Trả về giá vốn" / "Giữ giá"). Dùng class có sẵn của Sale AI: `toolbar`, `selection-bar`, `primary`, `small`, `money`, `result-note`, bảng như `pagedTable`.

## Hiện trạng (Claude đã đọc)
- `lib/kiot.js` `normalizeProduct` không lấy giá vốn. `raw.inventories[].cost` có trong `rawSource`.
- `lib/pricing.js` `calculate` không biết giá vốn.
- Các cổng ghi đều đòi `row.status==='simulated'`:
  - `auto-update.js` `autoSelection` (khoảng dòng 84)
  - `live.js` `prepare` (khoảng 185–191)
  - preflight ở `batch-update.js:18`, `batch-joint.js:45`, `joint-update.js:32`
- Số liệu thật ngày 10/11/2026, Claude chỉ đọc kho Sale AI và `server/data/catalog-cache.json`:
  - 1.547 món `simulated`, 23 món thiếu giá vốn.
  - 95 món đang bán dưới vốn, đều M1, Sale AI ghi ngày 02/11. Cả 95 món có P0 = giá vốn, 92 món là hàng ký gửi (KG).
  - Từ 16/11 đến 31/12 sẽ có thêm 25 món xuống dưới vốn (P0 > vốn).

## Phạm vi

### 1. Giá vốn
- `normalizeProduct` thêm `cost`: giá vốn cao nhất lớn hơn 0 trong `raw.inventories[].cost`, không có thì `null`. Giống `cost()` ở `BossTele/catalog.js:14`.
- Giả định đã báo Bảo: lấy mức cao nhất giữa các chi nhánh.
- Không đổi `kiot-fingerprint.js`.
- `samples.js`, `fake-sync.js` và fixture test đang dựng sản phẩm phải có `cost`, để dữ liệu mẫu và test cũ vẫn chạy. Ghi lý do trong result.

### 2. Tính giá (`calculate`)
- Thêm 2 lý do loại món, đặt cùng nhóm với kiểm tra hết tồn hoặc ngừng kinh doanh, trả `status:'excluded'`:
  - `cost` không phải số nguyên dương: `excludedReason:'missing_cost'`, lý do "Thiếu giá vốn trên Kiot: không tính".
  - `p0 <= cost`: `excludedReason:'p0_not_above_cost'`, lý do "Giá gốc không cao hơn giá vốn: không giảm".
- Sau khi có `price`: nếu `m>=1` và `price < cost` thì `status:'needs_approval'`, kèm `belowCost = cost - price` và lý do "Giá sale thấp hơn giá vốn: chờ duyệt".
- Kết quả luôn mang `cost`.
- Đổi chuỗi `POLICY` để bản chuẩn bị cũ bị xoá như các lần trước.

### 3. Chặn cập nhật thường
- `autoSelection` và mọi đường cập nhật tay hiện có không bao giờ ghi dòng `needs_approval` hay `excluded`. Cổng `simulated` đã làm việc này; thêm test để khoá lại.
- View `results` (Bảng giá sale) không trả dòng `needs_approval`. Bộ đếm, phân trang, lọc M và "Chọn tất cả (mọi trang)" (`live-ui.js`) cũng không tính các dòng đó.

### 4. Tab Duyệt — nhóm "Chờ duyệt"
- `view-data.js` thêm view `approval`, nhóm `pending`: dòng `needs_approval` có `currentPrice !== price`. Cột: Sản phẩm (mã + tên), M hiện tại → M mới, Giá Kiot / P0, Giá sale mới, Giá vốn, Thấp hơn vốn, nút Duyệt. Tìm kiếm và phân trang như `results`.
- Luồng ghi: dùng lại prepare → preview → xác nhận → commit hiện có, cùng đường ghi Kiot (và Sapo nếu đang bật ghi chung) như cập nhật tay. Thêm cờ `approveBelowCost:true` cho `/api/kiot/prepare` và `/api/kiot/preview`.
  - Có cờ: chỉ nhận dòng `needs_approval`, từ chối dòng `simulated`. Không cờ: giữ nguyên, từ chối `needs_approval`.
  - Bản cập nhật ghi `approval:{kind:'below_cost', at, by}`. `by` lấy người dùng web nếu runtime có sẵn; không có thì `null`, không bịa.
- Preflight trong 3 file batch/joint nhận `needs_approval` **chỉ khi** bản cập nhật có `approval.kind==='below_cost'`. Kiểm tra khác giữ nguyên, kể cả dừng ở lỗi đầu tiên.
- Lúc preflight, so `cost` đọc mới từ Kiot với `item.row.cost`. Khác nhau thì dừng, báo "Giá vốn trên Kiot đã thay đổi — tải lại và duyệt lại".
- Ghi xong thì `currentPrice===price`, món rời nhóm. Tới mốc sau mà vẫn dưới vốn thì món hiện lại. Không lưu duyệt vĩnh viễn.

### 5. Tab Duyệt — nhóm "Đã lỡ giảm dưới vốn"
- Thuộc nhóm này khi đủ 4 điều kiện:
  1. `cost` > 0.
  2. Giá Kiot hiện tại < `cost`.
  3. Giá Kiot hiện tại bằng giá Sale AI ghi và xác minh lần gần nhất (`expectedKiotPrices` trong `auto-update.js`). Tức là Sale AI gây ra, không phải người sửa tay.
  4. Món không nằm ở nhóm Chờ duyệt.
- Cột: Sản phẩm, M, Đang bán trên Kiot, Giá vốn, Thấp hơn vốn, 2 nút.
- **Trả về giá vốn** (từng món hoặc tất cả): ghi giá Kiot = `cost` qua cùng đường prepare → xác nhận → commit, cùng preflight và xác minh sau ghi.
  - Bản cập nhật ghi `approval:{kind:'restore_cost', at, by}`.
  - Sau khi ghi, kiểm tra lần sau không được coi đây là "giá sửa tay" (`manualPriceSkips`). `expectedKiotPrices` lấy giá đã ghi này.
  - Không đổi P0 hay chu kỳ M.
- **Giữ giá**: lưu xác nhận `{id, price, at, by}` vào kho Sale AI. Món rời nhóm. Nếu sau này giá Kiot của món đổi khác `price` đã xác nhận thì món được xét lại. Không ghi Kiot.
- Hộp xác nhận ghi rõ số món và tổng tiền:
  - Trả về giá vốn: "N món sẽ được ghi lại giá Kiot bằng giá vốn (tổng tăng X)".
  - Giữ giá: "N món giữ nguyên giá, chấp nhận thấp hơn giá vốn tổng X".

### 6. Giao diện
- Frontend `Webstie/frontend/src/price-system.tsx`: thêm nút `Duyệt (n)` vào nhóm nút `seg` cạnh `Bảng giá sale` / `Lịch sử`, mở iframe với `view=approval`.
  - Số n = tổng 2 nhóm, lấy từ API Sale AI (vd `/sale-ai/api/status` hoặc view nhẹ).
  - API lỗi thì hiện "Duyệt" không kèm số, không bịa số.
- Sale AI `public/app.js`, `live-ui.js`, `index.html`, `style.css`:
  - Tiêu đề `approval:'Duyệt'`; mô tả "Món giảm xuống dưới giá vốn: chỉ ghi lên Kiot khi bấm Duyệt."
  - Nhóm Chờ duyệt ở trên, nhóm Đã lỡ ở dưới, như ảnh demo.
  - Nhóm trống thì hiện "Không có món nào giảm dưới giá vốn hôm nay." / "Không có món nào đang bán dưới giá vốn."
  - Khoá nút khi đang có thao tác (`canWrite`), giữ nền walnut khi nhúng.
- Lịch sử: bản cập nhật có `approval.kind` hiện nhãn "Duyệt dưới giá vốn" hoặc "Trả về giá vốn".

### 7. BossTele
`BossTele/sale-price.js` dùng `calculate`. Dòng `needs_approval` hoặc `excluded` mới phải hiện qua nhánh "Chưa tính được giá sale: <lý do>" của `telegram-bot.js` `saleCaption`. Thêm 1 test, không đổi code bot nếu đã đúng.

## Ngoài phạm vi
- **Không ghi lên Kiot hay Sapo thật** khi làm hoặc test. Mọi test dùng fake client hoặc dữ liệu mẫu.
- Không đổi công thức M, quyền sale, lịch tự động (TASK-137/138).
- Không sửa `shared/`, `server/src/v2/**`, `server/src/services/**`.

## Tiêu chí nghiệm thu
1. Test mới (node:test trong `server/src/sale-ai/test/`) đạt:
   - Thiếu vốn → excluded `missing_cost`. P0 ≤ vốn → excluded `p0_not_above_cost`.
   - `price < cost` (P0 > vốn) → `needs_approval`. `price >= cost` → `simulated`.
   - `autoSelection` bỏ món `needs_approval` và `excluded`.
   - Prepare thường từ chối `needs_approval`. Prepare có cờ duyệt nhận và ghi được qua fake client, nhưng từ chối `simulated`.
   - Giá vốn đổi lúc preflight → dừng, không gửi PUT.
   - View `results` không có món chờ duyệt. View `approval` có đúng 2 nhóm.
   - Ghi xong thì món rời nhóm Chờ duyệt.
   - Trả về giá vốn ghi `cost` và món rời nhóm Đã lỡ. Lượt tự động sau không báo "giá sửa tay" cho món đó.
   - Giữ giá không gửi PUT, món rời nhóm. Đổi giá Kiot thì món được xét lại.
   - Lịch sử có nhãn đúng.
2. Test cũ không nới kỳ vọng. Fixture chỉ thêm `cost`, ghi lý do trong result.
3. `npm run build` và `npm test` tại `D:\Website_3Q\Webstie` đạt. `npm test` tại `D:\Website_3Q\Webstie\BossTele` đạt.
4. Sandbox chặn test (spawn EPERM) thì ghi `blocked`, không xin quyền; Claude sẽ tự chạy.

## Lệnh kiểm tra
```
cd D:\Website_3Q\Webstie && npm run build && npm test
cd D:\Website_3Q\Webstie\server\src\sale-ai\test && node --test *.test.js
cd D:\Website_3Q\Webstie\BossTele && npm test
```

## Vùng code
- **Điểm vào:**
  - `lib/kiot.js` `normalizeProduct`
  - `lib/pricing.js` `calculate`, `POLICY`
  - `lib/view-data.js` `filterResultRows`, `viewData`
  - `lib/live.js` `prepare`, `checkKiotSnapshot`
  - `lib/batch-update.js` `executeBatch`; `lib/batch-joint.js`; `lib/joint-update.js` `executeJoint`
  - `lib/auto-update.js` `autoSelection`, `expectedKiotPrices`
  - `core.js` handler (`/api/kiot/prepare`, `/api/kiot/preview`, `/api/view`, `/api/status`, endpoint mới cho Giữ giá)
  - `public/app.js` (`view`, tiêu đề dòng 195, `pages`), `public/live-ui.js`, `public/history-model.js`, `lib/update-report.js`
  - `frontend/src/price-system.tsx` `SaleAi`
- **Phạm vi ảnh hưởng:** `BossTele/sale-price.js` (đọc `calculate`), `samples.js`, `fake-sync.js`, `frontend/task041.spec.ts` nếu có kiểm tab Price System.
- **Test liên quan:** toàn bộ `server/src/sale-ai/test/*.test.js` (đặc biệt `simulator`, `live`, `batch-update`, `joint-update`, `batch-joint`, `auto-update`, `auto-update-ui`, `background-ui`) và `BossTele/test/sale-price.test.js`.
- **Không đụng:** `shared/**`, `server/src/v2/**`, `server/src/services/**`.

## Rủi ro đã báo Bảo
- Món chưa có giá vốn trên Kiot (hôm nay 23 món) và món có giá gốc ≤ vốn (gồm 95 món đang lỡ) sẽ **không được giảm** cho tới khi sửa giá vốn hoặc giá gốc.
- Giá vốn lấy mức cao nhất giữa các chi nhánh.
