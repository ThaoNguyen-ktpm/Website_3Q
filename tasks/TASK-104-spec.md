# TASK-104 — Sale AI giai đoạn 1: gắn lõi vào máy chủ web, bỏ tiến trình riêng, dữ liệu gọn

- Dự án: web
- Người phụ trách: Codex (thực hiện, kiểm tra), Claude (đặc tả, review)
- Trạng thái: `ready`
- Hành động gần nhất, ngày 29/10/2026:
  - Bảo chốt: trang 8787 là trang chính; trang cũ 5173 và Sale AI là chức năng gắn vào. Với Sale AI, "chỉ lấy phần code gắn API", không giữ chương trình chạy riêng.
  - Bảo duyệt kế hoạch 3 giai đoạn và cách tối ưu dữ liệu: không mang data cũ, xuất riêng lịch sử, giới hạn bảng kết quả, dọn blob định kỳ.
  - Đặc tả này **thay bản TASK-104 trước** (bản "dời nguyên thư mục `D:\BaoQ-AI` vào `Webstie/SaleAI`"), bản đó bỏ.
- Bước tiếp theo: Codex làm sau TASK-041, viết `TASK-104-result.md`; Claude review.
- Mã 104: Sale AI đã dùng TASK-023…103 trong `D:\BaoQ-AI\tasks`, nên đánh số tiếp từ đó để không trùng.

## Ba giai đoạn (chỉ giai đoạn 1 thuộc task này)

1. **Giai đoạn 1 (task này):** lõi Sale AI chạy trong máy chủ web (cổng 4000), bỏ cổng 4310; dữ liệu mới, gọn; giao diện cũ vẫn dùng tạm.
2. Giai đoạn 2 (task sau): viết giao diện Sale AI bằng React trong 8787, bỏ giao diện cũ và khung nhúng.
3. Giai đoạn 3 (task sau): đổi `D:\BaoQ-AI` thành lưu trữ, bỏ trang cũ 5173 khi 8787 đủ chức năng.

## Hiện trạng đã kiểm tra

- `D:\BaoQ-AI`: Node ESM, không có thư viện ngoài, không dùng Git.
  - **Lõi:** `lib/` gồm 22 file, ~150KB: `pricing`, `service` (Simulator), `live`, `kiot`, `sapo`, `restore`, `joint-update`, `batch-joint`, `split-store`, `store`…
  - **Vỏ HTTP:** `server.js` ~15KB, ~25 API: `/api/status`, `/api/state`, `/api/view`, `/api/run`, `/api/table/ensure`, `/api/manual-price`, `/api/scenarios`, `/api/kiot/{preview,prepare,commit,cancel,retry,retry-selection,selection,refresh,diagnose,mapping,restore/prepare,restore/commit}`, `/api/history/updates/…`, `/api/sapo/{status,refresh,check,mapping}`.
  - **Giao diện cũ:** `public/` 6 file, ~75KB. Gọi API bằng đường dẫn **tương đối** (`fetch(path.replace(/^\//, …))`).
  - **Test:** khoảng 28 file `*.test.js` ở gốc, chạy bằng `node --test`, 252 test.
- Máy chủ web hiện chuyển tiếp nguyên khối `/sale-ai/*` sang `127.0.0.1:4310` (`server/src/routes/saleAiRoutes.ts`), sau `requireAuth`, `requirePermission('sale.manage')`, `requireSameOrigin` (`app.ts:41`). Sale AI chỉ nhận yêu cầu có `x-sale-ai-token` = `INTERNAL_TOKEN`.
- `scripts/dev.mjs` bật Sale AI bằng `spawn('node server.js', { cwd: saleAiDir })`, chỉ truyền cho tiến trình này các khoá `KIOT_*`, `SAPO_*` đọc từ `BossTele/.env`.
- Tải lại Kiot của Sale AI đi qua máy chủ web bằng `INTERNAL_TOKEN` (TASK-036).
- BossTele `sale-price.js` đọc thẳng file `data/kiot-state.store` và `lib/pricing.js` của Sale AI qua `BAOQ_AI_DIR` (mặc định `D:/BaoQ-AI`). E2E `server/src/tests/saleAiUpdateAll.test.ts` cũng dùng `BAOQ_AI_DIR`.
- Dữ liệu `D:\BaoQ-AI\data` 864MB, 84.222 file:
  - **Bảng kết quả (`runs`):** 56 bảng × ~7MB ≈ 400MB. Mỗi ngày tạo bảng mới chứa toàn bộ ~4.500 món, không bao giờ xoá.
  - **Blob cũ:** nhiều blob không còn được tham chiếu.
  - **Lịch sử (`updates`):** 75 lượt, 1,1MB. Mọi lượt ghi giá thật (SP000009, SP000028, SP024383–SP024387…, từ 08/10 đến 27/10) **đều đã được rollback**. Claude đối chiếu ngày 29/10; Codex kiểm lại ở bước 1.2.
  - Bảo xác nhận chỉ chạy thử, **không cần giữ data cũ**.

## Yêu cầu

### 1. Chuẩn bị

1. Làm sau TASK-041, hoặc trên nhánh riêng.
2. **Kiểm lại** lịch sử trong `D:\BaoQ-AI\data\kiot-state.store`: với mọi lượt `joint-v1` có ghi thành công, sản phẩm đã được khôi phục bởi một lượt `restore-joint-v1` sau đó. Nếu có món chưa khôi phục: **dừng, báo Bảo**, không làm tiếp.
3. Xuất riêng lịch sử (`updates`, 75 lượt) và `prepared` thành một file JSON. Đặt ở `D:\BaoQ-AI\lich-su-cap-nhat-2026-10-29.json` để lưu trữ, không đưa vào Git. Không sửa, không xoá `D:\BaoQ-AI`.

### 2. Lõi vào máy chủ web

1. Chép **nguyên** `lib/` (22 file) vào `Webstie/server/src/sale-ai/lib/`. Chép các `*.test.js` của Sale AI vào `Webstie/server/src/sale-ai/test/`, giữ chạy bằng `node --test`. Chỉ sửa `import` đường dẫn nếu bắt buộc.
2. **Không viết lại logic** cập nhật, rollback, kiểm tra trước/sau ghi, đối chiếu SKU Sapo, nhật ký. Nếu buộc phải sửa `lib/`, ghi lý do và test đi kèm trong kết quả.
3. Máy chủ TypeScript (`module: NodeNext`, `include: src/**/*.ts`):
   - được phép thêm khai báo kiểu (`.d.ts`) hoặc bật `allowJs` có giới hạn để `import` lõi JS;
   - `npm run build` (`tsc`) phải đạt, và `dist` phải chạy được với lõi JS (chép kèm khi build nếu cần).
4. Viết router Express thay cho `server.js` của Sale AI:
   - gắn tại **`/sale-ai/api/*`** với cùng tên API, cùng dạng yêu cầu/trả về như `server.js` cũ, để giao diện cũ chạy không đổi;
   - giữ các chặn: `requireAuth`, `requirePermission('sale.manage')`, `requireSameOrigin`.
   - Bỏ các lớp bảo vệ chỉ dành cho tiến trình riêng: kiểm tra Host localhost, `x-sale-ai-token`.
   - Không còn cổng 4310.
5. Phát giao diện cũ (`public/`) tại `/sale-ai/` từ máy chủ web: chép vào `Webstie/server/src/sale-ai/public/`. Trang 8787 và 5173 vẫn nhúng `/sale-ai/?view=…&embed=1` như hiện nay. Giữ `&theme=walnut`.
6. Khởi tạo lõi **một lần** khi máy chủ khởi động, không làm chậm bước mở cổng 4000:
   - `Simulator`, `LiveService`, `SapoService`, kho `SplitStore`;
   - nếu lõi chưa sẵn sàng thì API Sale AI trả 503 và giao diện báo "đang khởi động".
7. Khoá Kiot/Sapo: máy chủ web cần `KIOT_*`, `SAPO_*` cho lõi.
   - Dùng cùng cách máy chủ đang lấy khoá Kiot cho tìm kiếm sản phẩm nếu đã có; nếu chưa có thì để `dev.mjs` truyền vào tiến trình máy chủ qua bộ nhớ, như đang làm cho Sale AI.
   - Không ghi khoá ra file, không in ra log.
8. Tải lại Kiot (TASK-036): lõi gọi thẳng hàm tải danh mục của máy chủ, không vòng qua HTTP `/internal`. Vẫn dùng chung một lượt tải với tìm kiếm sản phẩm.
9. `dev.mjs`: bỏ khối bật Sale AI riêng (`saleAiDir`, `spawn('node server.js')`, kiểm tra cổng 4310). `SALE_AI_URL` và proxy `saleAiRoutes.ts` cũ bỏ.

### 3. Dữ liệu mới, gọn

1. Thư mục dữ liệu: `Webstie/server/data/sale-ai/`. Đã nằm trong `.gitignore` (`Webstie/server/data/`). **Không chép** `D:\BaoQ-AI\data`. Kho bắt đầu trống, tự tạo lại khi bấm "Tải lại từ Kiot".
2. **Giới hạn bảng kết quả:**
   - giữ tối đa **7 bảng gần nhất** (`runs`, mới nhất ở đầu: `live.js:235`, `service.js:90`), số này đọc từ cấu hình, mặc định 7;
   - không xoá bảng đang được một lượt `prepared` hoặc lượt cập nhật đang chạy tham chiếu.
   - Đây là thay đổi nhỏ trong lõi, cần test riêng.
3. **Dọn blob không còn tham chiếu:**
   - dùng lại logic `D:\BaoQ-AI\scripts\store-cleanup.mjs` (có khoá bảo trì);
   - chạy khi máy chủ khởi động trước khi mở kho, và sau mỗi lần cắt bảng;
   - không chạy song song với một lần ghi.
4. Ghi trong kết quả: dung lượng `server/data/sale-ai` sau một lần "Tải lại từ Kiot" + "Kiểm thử" (dự kiến vài chục MB thay vì 864MB).

### 4. Nơi khác đang dùng Sale AI

1. `BossTele/sale-price.js` và test: đọc `pricing.js` và kho từ chỗ mới (`../server/src/sale-ai/lib/pricing.js`, `../server/data/sale-ai/kiot-state.store`). Vẫn nhận `BAOQ_AI_DIR` để ghi đè.
2. `server/src/tests/saleAiUpdateAll.test.ts` (14 test E2E): chạy với lõi trong máy chủ, kho ở thư mục tạm.
3. Câu báo "Sale AI chưa chạy…" ở `client/src/admin/views/App.jsx` và `frontend/src/price-system.tsx`: bỏ hướng dẫn "chạy npm run dev tại…"; thay bằng báo lỗi chung kèm nút Thử lại.
4. `AGENTS.md`, `CLAUDE.md`, `tasks/README.md`:
   - Sale AI là một phần của máy chủ web;
   - lệnh test Sale AI (`node --test` trong `server/src/sale-ai/test`);
   - quy tắc đánh số task tính cả `D:\BaoQ-AI\tasks` cũ.

### 5. Rủi ro phải đo và báo

1. **Web khựng khi Sale AI lưu:** đo thời gian lưu (`saveMs` trong log `BAOQ timings`) và độ trễ một API web khác (`/api/auth/me`) trong lúc "Kiểm thử" và "Cập nhật" chạy.
   - Nếu API web chậm hơn 300ms vì Sale AI: chuyển phần lưu hoặc lõi sang `worker_threads` trong cùng máy chủ, hoặc ghi rõ đề xuất cho task sau.
2. **Hai lượt cùng lúc:** giữ khoá "Đang xử lý một lượt khác" (409) của lõi. Hai người bấm cùng lúc thì một người nhận 409.

## Quy tắc an toàn (bắt buộc)

- Không gửi cập nhật hay rollback thật lên Kiot/Sapo trong task này. Chỉ dùng test, giả lập và kho tạm.
- Không đổi công thức giá; không bật `SALE_AI_BATCH`; không bỏ bước đọc lại trước khi gửi.
- Không xoá `D:\BaoQ-AI` hay file nào trong đó.
- `server/data/`, `.env` không lên Git; hook gitleaks phải qua.

## Tiêu chí nghiệm thu

1. `node --test` trong `server/src/sale-ai/test`: toàn bộ test lõi qua (252 trước khi chuyển, cộng test mới cho giới hạn bảng và dọn blob).
2. `npm run build` và `npm test` tại `Webstie` đạt. `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` tại `Webstie/server` đạt 14 test.
3. `npm test` tại `Webstie/BossTele` đạt; giá sale trong BossTele đọc từ chỗ mới.
4. `npm run dev`: chỉ còn cổng 4000, 5173, 8787 (và bot). Không còn tiến trình Sale AI riêng, không còn cổng 4310.
5. Đăng nhập Admin ở 8787 → Price System → Sale AI:
   - hiện bảng sau khi "Tải lại từ Kiot" và "Kiểm thử";
   - Lịch sử trống (dữ liệu mới), không lỗi;
   - người không có `sale.manage` gọi `/sale-ai/api/state` nhận 403.
6. Sau 8 lần "Kiểm thử" khác ngày (dùng đồng hồ giả lập trong test): còn 7 bảng; blob của bảng bị bỏ được dọn.
7. `git grep -n "4310\|BaoQ-AI"` không còn trong code chạy. Tài liệu lịch sử được giữ nguyên.
8. `TASK-104-result.md` ghi:
   - kết quả kiểm lịch sử rollback;
   - nơi đặt file xuất lịch sử;
   - danh sách file chép;
   - mọi chỗ phải sửa trong `lib/`;
   - số đo khựng và dung lượng dữ liệu;
   - kết quả từng lệnh.

## Vùng code

- **Điểm vào:**
  - `Webstie/server/src/app.ts` (dòng gắn `/sale-ai`, ~41);
  - `Webstie/server/src/routes/saleAiRoutes.ts` (thay bằng router mới);
  - `Webstie/server/src/server.ts` (khởi tạo lõi);
  - `Webstie/scripts/dev.mjs` (khối Sale AI);
  - `D:\BaoQ-AI\server.js` (nguồn để viết router), `D:\BaoQ-AI\lib\*.js` (chép), `D:\BaoQ-AI\scripts\store-cleanup.mjs` (dọn blob);
  - `Webstie/BossTele/sale-price.js` (`defaults.saleDir`, `readSaleStore`).
- **Phạm vi ảnh hưởng:**
  - `requireSameOrigin`, `allowedOrigin`;
  - dịch vụ danh mục Kiot của máy chủ (tải chung);
  - giao diện cũ nhúng ở `client` (5173) và `frontend` (8787).
- **Test liên quan:**
  - toàn bộ test Sale AI chuyển sang;
  - `server/src/tests/saleAiUpdateAll.test.ts`;
  - `BossTele/test/sale-price.test.js`;
  - test mới cho router (403 khi thiếu quyền, 503 khi lõi chưa sẵn sàng), giới hạn bảng, dọn blob.
- **Không đụng:**
  - công thức trong `lib/pricing.js`;
  - logic ghi giá và rollback (ngoài đường dẫn và giới hạn bảng);
  - `D:\BaoQ-AI\outputs`, `D:\BaoQ-AI\tools`;
  - giao diện React mới cho Sale AI (giai đoạn 2).

## Điểm cần quyết định (Bảo)

1. ~~Giữ 7 bảng kết quả gần nhất có đủ không?~~ Bảo chốt 29/10/2026: **7 bảng là đủ** (vẫn đổi được trong cấu hình).
2. Giai đoạn 2 (giao diện React trong 8787) làm ngay sau task này hay đợi dùng thử giai đoạn 1 vài ngày?

## Ghi chú khi giao (Claude, 29/10/2026 chiều)

- Bảo cho làm TASK-104 **ngay, chưa đợi TASK-041 xong**.
- Thư mục làm việc đang có nhiều thay đổi **chưa commit** của 8787 và TASK-041: `frontend/src/*`, `scripts/dev.mjs`, `server/src/config/*`, `server/src/services/staffService.ts`… Yêu cầu:
  - **không revert, không ghi đè, không định dạng lại** các thay đổi này;
  - khi phải sửa chung file (ví dụ `scripts/dev.mjs`), chỉ sửa đúng khối Sale AI;
  - liệt kê riêng các file TASK-104 sửa trong `TASK-104-result.md`.
- TASK-103 (review Sale AI tại `D:\BaoQ-AI`) **chưa có kết quả**. `D:\BaoQ-AI\lib` chưa đổi từ 27/10. Yêu cầu:
  - chép `lib/` hiện tại;
  - ghi vào kết quả SHA-256 của từng file đã chép, để khi TASK-103 xong còn biết phải đồng bộ sửa lỗi nào sang bản trong máy chủ.
- Dung lượng hiện tại để so sánh (Claude đo 29/10):
  - `D:\BaoQ-AI\data` = 899MB, trong đó `kiot-state.store` 826MB;
  - 59 bảng `runs` × ~7,2MB ≈ 425MB;
  - 191MB blob không còn tham chiếu;
  - 4.474 sản phẩm chỉ chiếm 8,7MB.
- Không commit. Claude review sau khi có `TASK-104-result.md`.

## Quyết định mục 1.2 (Bảo, 29/10/2026)

Codex dừng ở mục 1.2: 4 lượt ghi thành công của SP000009 (10–11/10) chưa đủ bằng chứng khôi phục trong nhật ký (`TASK-104-result.md`).

Claude đã đọc trực tiếp SP000009 trên Kiot (ID 17142603) và Sapo (ID 91211362), **chỉ GET, không ghi**:

- **Sapo:** giá 5.000.000đ, mô tả trống. Khớp mọi bản `sapo.before` (mô tả rỗng).
- **Kiot:**
  - giá 5.000.000đ, đúng giá gốc;
  - mô tả 257 ký tự, khớp đúng bản `before` của lượt ghi cuối 19/10 (hash `c6db913190`), tức lượt khôi phục sau cùng đã đưa về đúng;
  - mô tả còn sót 9 thẻ ghi chú rỗng `<!--BAOQ-CURRENT-->` từ các lượt thử 08–11/10; không chứa giá hay ghi chú nội bộ;
  - mã định danh khác bản 08/10 (`GGS-BEI` thành `NULL-NULL`); Kiot ghi sửa lúc 21/10, sau lượt khôi phục cuối, nên không do Sale AI.

**Bảo quyết định:**
- coi SP000009 đã khôi phục xong; **làm tiếp TASK-104 từ mục 1.3**;
- Bảo tự dọn mô tả Kiot của SP000009 sau. Task này **không** ghi gì lên Kiot/Sapo.

Ghi tóm tắt quyết định này vào `TASK-104-result.md`.

## Ghi chú làm tiếp (Claude, 30/10/2026)

Phiên Codex trước dừng giữa chừng (app khởi động lại). Đã có:
- file xuất lịch sử `D:\BaoQ-AI\lich-su-cap-nhat-2026-10-29.json`;
- bản chép `Webstie/server/src/sale-ai/{lib,public,test}`;
- `lib/retention.js`, `lib/store-cleanup.js`; `service.js` và `split-store.js` đã sửa trong bản chép.

**Làm tiếp từ đó, không chép lại đè lên.** Đọc lại `TASK-104-result.md` và các file trên trước khi sửa.

Đã đổi sau lần chép, phải giữ:
- **TASK-105** đã đổi quy tắc giá: `pricing.js` mới, POLICY `baoq-2026-10-29-jul-batch-v9`. Bản chép trùng bản gốc. **Không dùng lại `pricing.js` cũ.**
- **TASK-106** đã sửa cách BossTele và trợ lý nhận mã có đuôi (`SP025211_KG`): `BossTele/sale-price.js`, `BossTele/telegram-bot.js`, `BossTele/lib/`, `server/src/services/assistant/`. Khi đổi đường dẫn Sale AI trong `sale-price.js`, **giữ nguyên** phần nhận mã của TASK-106.

Hai lỗi cần sửa trong task này:
1. `npx vitest run` của server đang quét luôn `src/sale-ai/test/*.test.js` (test kiểu `node --test`) nên báo FAIL. Loại thư mục này khỏi vitest (cấu hình `exclude`). Test lõi chạy riêng bằng `node --test`. Có thể thêm script `test:sale-ai`, và `npm test` của server gọi cả hai.
2. Có thư mục rỗng `server/src/sale-ai/data/sapo-state.store`, có lẽ do test tạo ra. Dữ liệu phải nằm ở `server/data/sale-ai/` (đã gitignore). Không để test hay lõi tạo dữ liệu trong `src/`; xoá thư mục rỗng này.

Cách làm việc:
- Codex chạy `-a never`: lệnh nào bị sandbox chặn (spawn EPERM) thì ghi lại, không xin quyền. Claude sẽ tự chạy toàn bộ lệnh nghiệm thu.
- **Không** dừng hay khởi động lại server đang chạy (Bảo đang dùng Sale AI cũ ở 4310). Claude sẽ khởi động lại khi review.
