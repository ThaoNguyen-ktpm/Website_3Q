# TASK-104 — Kết quả tích hợp Sale AI vào máy chủ web

- Dự án: web; người thực hiện: Codex.
- Trạng thái: `ready_for_review` (code đã triển khai; chưa được Claude nghiệm thu).
- Hành động gần nhất: 30/10/2026, tiếp tục bản chép đã có, hoàn thiện router/runtime, đường dẫn, giữ bảng/dọn blob, build và kiểm tra cục bộ.
- Bước tiếp theo: Claude review và chạy các lệnh nghiệm thu bên ngoài giới hạn sandbox; chủ động chuyển server khi Bảo sẵn sàng. Phiên này không chạy `npm run dev`, không dừng/khởi động lại server đang dùng.

## Quyết định mục 1.2 và lịch sử lưu trữ

Theo quyết định Bảo trong mục cuối đặc tả: coi SP000009 đã khôi phục xong dựa trên đối chiếu GET của Claude; tiếp tục từ 1.3. Bảo tự dọn mô tả Kiot sau; TASK-104 không ghi hay khôi phục gì lên Kiot/Sapo thật. Đây là quyết định bàn giao, không phải kết quả GET mới của Codex.

Đã xác minh lại file xuất có sẵn `D:\BaoQ-AI\lich-su-cap-nhat-2026-10-29.json`: **75 updates, 1 prepared, 1.718.381 byte**, SHA-256 `29fdd9e12af2050195c217e4ead26c0f23c9f14c90d1bbb6998cc567ca28dce8`. Không xuất lại, không ghi đè, không sửa/xóa dữ liệu gốc.

## Đã triển khai

1. `server/src/sale-ai/core.js`: chuyển vỏ HTTP hiện hành thành handler dùng trong Express, giữ tên API, payload, mã lỗi và các bước lõi trước/sau ghi. Không tạo HTTP server/cổng riêng. API giữ giới hạn body 1 MiB cho prepare/preview và 16 KiB cho các POST khác; giữ 409 cho thao tác trùng, 410 cho chức năng đã bỏ, static allowlist/CSP/ETag. Bỏ Host localhost và token nội bộ của proxy; auth, `sale.manage`, same-origin vẫn ở app.ts. Không thay bằng API giả.
2. `runtime.ts`: khởi tạo một lần bất đồng bộ sau listen; router trả 503 và trang tự thử lại khi chưa sẵn sàng. Khóa Kiot/Sapo lấy bằng **cùng `BossTele/lib/connection-config.js` như catalogStore**, giữ nguồn cấu hình dự án làm chuẩn, chỉ dùng trong bộ nhớ, không log giá trị. Kiot reload gọi trực tiếp `catalogStore.sync()`/`rawRows()` và chuẩn hóa bằng adapter hiện có; không vòng HTTP `/internal`, không tải lần thứ hai. Timer chỉ cập nhật bảng theo ngày, không tự gửi giá. Batch sản xuất luôn tắt.
3. Kho mới mặc định `Webstie/server/data/sale-ai/`, cùng đường dẫn khi chạy src hay dist. Source mẫu trong runtime rỗng; không mang dữ liệu cũ. Chỉ thử bằng fixture và kho tạm. Không tạo/làm đầy kho sản xuất trong phiên này.
4. Bỏ proxy `SALE_AI_URL`, toàn bộ khối khởi chạy Sale AI riêng ở `scripts/dev.mjs`; giữ phần frontend 8787 và EXTRA_ORIGINS có sẵn. Không chạy dev để tránh ảnh hưởng các server Bảo đang sử dụng.
5. BossTele đọc pricing tại `../server/src/sale-ai/lib/pricing.js`, kho tại `../server/data/sale-ai/kiot-state.store`; giữ `BAOQ_AI_DIR` ghi đè theo layout cũ, thêm `dataDir` tùy chọn để kiểm thử/định vị kho. Giữ nguyên logic nhận mã đuôi của TASK-106.
6. Hai giao diện nhúng giữ đường dẫn cùng origin, `embed=1`, `theme=walnut`, thông báo lỗi chung và nút Thử lại. Chỉ sửa đoạn Sale AI; không xây giao diện React giai đoạn 2.
7. Tách Vitest khỏi `src/sale-ai/test/**` bằng config exclude. `npm test` server chạy Vitest rồi `test:sale-ai`; test lõi vẫn dùng node:test. TypeScript chỉ nhận JS dưới sale-ai, loại test; build tsc chép JS và script chép public vào dist.
8. 14 ca E2E chuyển từ server/cổng cũ sang handler trong máy chủ, kho tạm và mock runtime resolver. Các hành vi cũ được giữ. **Đổi đồng hồ fixture từ 19/10 sang 16/11** để vẫn kiểm tra M2 = 33.400.000đ theo TASK-105 (01/11 M1, 16/11 M2); không đổi/nới lỏng assertion để che lỗi. Cần Claude chạy lại toàn bộ 14 ca vì Vitest bị sandbox chặn.
9. Test-only `legacy-server.js` giữ vỏ cũ cho bộ hồi quy; mọi kho mặc định chuyển vào thư mục tạm, kể cả khi store trong bộ nhớ không có path. Đã kiểm thư mục `src/sale-ai/data/sapo-state.store` rỗng rồi xóa riêng bằng lệnh không recursive; đường dẫn đó không còn sau test. Không xóa thứ gì trong `D:\BaoQ-AI`.

## Mọi thay đổi trong lib và lý do

- `service.js`: gọi retainRuns trước khi công bố/lưu sau mutate, nhận maxRuns từ `SALE_AI_MAX_RUNS` (mặc định 7).
- `retention.js` (mới từ phiên trước): giữ 7 bảng đầu cùng bảng được prepared hoặc attempt running tham chiếu; kiểm cấu hình số nguyên dương. Chỉ thay mảng khi thực sự cắt, để giữ nhận dạng snapshot bất biến/cache lịch sử của lõi. Test cũ `split-store.test.js` đã bắt lỗi tạo mảng mới không cần thiết; đã sửa logic, không sửa assertion đó.
- `split-store.js`: nhận biết bảng bị cắt, kể cả lần lưu đầu sau mở lại kho; dọn dưới maintenance lock. Chỉ dọn store vừa lưu để không làm cache blob của store khác mất hiệu lực. Xóa cache hash/identity sau dọn; nếu bảo trì lỗi sau khi manifest đã commit, giữ kết quả ghi thành công, cảnh báo chung và thử dọn lại lần lưu sau, tránh lệch state bộ nhớ/đĩa.
- `store-cleanup.js` (mới từ phiên trước): dùng logic audit/hash/path/maintenance lock từ script gốc. Thêm chọn store và xử lý thư mục store mới còn trống (Sapo chưa có catalog); startup chạy trước khi mở các kho. Không coi một kho có blob/activated nhưng mất manifest là kho trống. Không dọn khi writer đang giữ khóa.
- `kiot.js`: chỉ thêm JSDoc cho credentials và progress để TypeScript import JS đúng kiểu; thân hàm/logic mạng không đổi.
- **Không sửa pricing.js**: bản tích hợp vẫn trùng bản gốc hiện tại, POLICY `baoq-2026-10-29-jul-batch-v9`. Các lib khác trùng nguồn hiện tại theo hash, gồm logic cập nhật/khôi phục/read-back. Không bật `SALE_AI_BATCH` trên môi trường hay cấu hình sản xuất; các ca batch chỉ chạy fixture.

## File thuộc TASK-104

- Lõi/giao diện/test đã chép: `Webstie/server/src/sale-ai/{lib,public,test}/`; không chép lại đè lên bản từ phiên trước. Có 28 file test nguồn, thêm `retention.test.js` và `runtime.test.js`, adapter `test/legacy-server.js`, helper Mac dưới test/scripts.
- Mới: `Webstie/server/src/sale-ai/core.js`, `runtime.ts`, `server/scripts/copy-sale-ai.mjs`, `server/vitest.config.ts`.
- Sửa: `Webstie/server/{package.json,tsconfig.json}`, `server/src/{app.ts,server.ts,config/env.ts,routes/saleAiRoutes.ts,tests/saleAiProxy.test.ts,tests/saleAiUpdateAll.test.ts}`, `Webstie/scripts/dev.mjs`, `Webstie/BossTele/{sale-price.js,test/sale-price.test.js,AGENTS.md}`, `Webstie/client/src/admin/views/App.jsx`, đoạn Sale AI trong `Webstie/frontend/src/price-system.tsx`, `AGENTS.md`, `CLAUDE.md`, `tasks/README.md`.
- Bằng chứng/handoff: `tasks/TASK-104-{plan.md,result.md,source-hashes.json,current-hashes.json,smoke.mjs,measurements.json,measurements-dist.json,*tests.log,core-final.log,core-default.log}`. Script xuất có sẵn `TASK-104-export.mjs` không chạy lại.
- Những thay đổi có sẵn của TASK-041/8787, TASK-105, TASK-106 và các skill không bị revert. Trong file chung chỉ chỉnh phần liên quan Sale AI. Không stage, commit hay push.

## Kiểm tra thực tế ngày 30/10

- `npm.cmd run build` tại Webstie: **server tsc + chép public đạt**, client tsc đã qua, Vite client bị `spawn EPERM` lúc khởi động esbuild. Build toàn bộ **chưa đạt** trong sandbox.
- `npm.cmd run build --workspace server` tại Webstie (lần cuối sau sửa runtime/router): **exit 0**. Source JS, public và handler trong dist chạy được bằng smoke bên dưới.
- `npm.cmd test` tại Webstie: **bị spawn EPERM** khi Vitest load config. Thử thêm `vitest run --configLoader native --pool threads`: 31 suite chưa chạy được test, `spawn EPERM` ở Vite windowsSafeRealPathSync; không coi là lỗi logic 31 suite.
- `npm.cmd run test:sale-ai` tại server: default node:test bị **spawn EPERM** cho tiến trình test. Log `TASK-104-core-default.log`.
- Fallback không cần quyền: `node --test --test-isolation=none src/sale-ai/test/*.test.js` tại server: **193/193 pass, 0 fail, 0 skipped, exit 0**, khoảng 71,2 giây; log `TASK-104-core-final.log`. Đây là số test thực tế ở chế độ không cách ly; không tự ghi 252/252 theo con số baseline của đặc tả khi lệnh default chưa chạy được.
- Lượt full trước bắt lỗi mất reference runs ở `split-store.test.js:68`; đã sửa retainRuns, giữ nguyên test. Bộ storage/retention sau sửa **12/12 pass** (`TASK-104-storage-tests.log`). Lượt cuối toàn bộ 193/193 xác nhận lại.
- `SALE_AI_E2E=1 npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts`: **spawn EPERM**, chưa xác minh 14 ca E2E bằng Vitest.
- `npm.cmd test` tại BossTele: bị **spawn EPERM** ở runner. Fallback `node --test --test-isolation=none test/*.test.js`: **108 pass, 29 fail**, toàn bộ 29 lỗi thuộc các ca CLI trong `add.test.js`, do `spawnSync node.exe EPERM`; log `TASK-104-bosstele-tests.log`. Không sửa/nới test CLI.
- `node --test --test-isolation=none test/sale-price.test.js test/sku.test.js` tại BossTele: **11/11 pass**, không skipped; dùng pricing mới và nhận mã đuôi.
- `node tasks/TASK-104-smoke.mjs` và `node tasks/TASK-104-smoke.mjs --built`: **exit 0**, fixture 4.474 sản phẩm. Lần built cuối dùng **chính createSaleAiRouter đã build**, kiểm tra 503 trước sẵn sàng, 403 thiếu quyền, chặn Origin lạ, 409 hai thao tác cùng lúc, lịch sử trống rồi có kết quả, refresh/run/prepare/commit giả lập, static CSP/ETag 304 và chức năng đã bỏ 410. Không dùng server đang chạy.
- `git diff --check`: exit 0 (chỉ có thông báo Git về LF/CRLF của file có sẵn).
- `node --check Webstie/scripts/dev.mjs`: exit 0. Tìm `4310|BaoQ-AI|SALE_AI_URL` trong code chạy không còn kết quả; test-only legacy/Mac và tài liệu lịch sử vẫn được giữ. `git check-ignore Webstie/server/data/sale-ai/kiot-state.store/manifest.json` xác nhận kho bị ignore.
- `gitleaks git --pre-commit --staged --redact --no-banner`: exit 0, **0 byte staged** vì không stage. Chạy thêm `gitleaks dir Webstie/server/src/sale-ai --redact --no-banner` và `gitleaks dir tasks --redact --no-banner`: exit 0, không phát hiện bí mật. Không gọi kết quả staged scan rỗng là đã quét mọi thay đổi có sẵn.
- Review nội bộ độc lập theo skill requesting-code-review: không có phát hiện lỗi cụ thể; nhắc rõ test legacy không thay cho E2E Express. Review này không thay Claude và không đổi trạng thái thành verified.

## Dung lượng và độ khựng — chỉ là fixture, không phải dữ liệu Kiot thật

Chứng cứ nguồn: `TASK-104-measurements.json`; lần dist/router cuối: `TASK-104-measurements-dist.json`. Đều dùng 4.474 sản phẩm fixture trong thư mục tạm, 50 sản phẩm được cập nhật giả lập, batchWrites=false.

- Sau refresh + run: **13.768.638 byte (~13,77 MB)**; sau commit: **19.821.776 byte (~19,82 MB)**. Đây là kho tạm có schema/store thật, không phải phép đo `server/data/sale-ai` sau tải Kiot thật; mục đó chưa xác minh vì không chuyển/restart server đang dùng.
- Source smoke: run ~803 ms; GET `/api/auth/me` tối đa **574,4 ms** lúc run; prepare ~70 ms, auth tối đa ~33,7 ms; commit ~1.120 ms, auth tối đa ~9,4 ms. BAOQ timings prepare saveMs ~25,6; commit saveMs ~338,4 (cộng nhiều checkpoint).
- Dist qua router thật (lần cuối): run ~2.247 ms; auth tối đa **1.680,8 ms**; prepare ~122 ms, auth tối đa ~62,9 ms; commit ~1.477 ms, auth tối đa ~83,2 ms. BAOQ timings prepare saveMs ~40,1; commit saveMs ~630,3 (tổng checkpoint, không phải một lần chặn event loop).
- Auth probe dùng controller `/api/auth/me` thật nhưng **không có phiên đăng nhập, trả 401**, không truy vấn SQLite cho user. Xác thực cho fixture Sale AI được mô phỏng; middleware permission/same-origin và router/core là code thật. Số đo phụ thuộc tải máy, không đại diện production hay phiên Admin thật.
- **Đã vượt 300 ms khi tạo bảng. Đề xuất task sau:** đưa tạo/serialize bảng và công bố kết quả, hoặc toàn bộ lõi, vào `worker_threads` trong cùng máy chủ; đo lại trên danh mục thật và phiên đăng nhập thật. Không kết luận chỉ ghi đĩa gây chậm: calculate/clone/JSON response cũng chạy đồng bộ. Đặc tả mục 5.1 cho phép ghi đề xuất task sau; chưa triển khai worker trong task này.

## Giới hạn và lệnh bàn giao cho Claude

Không xác minh UI Admin 8787, Google login thật, phiên user thật thiếu quyền, reload Kiot thật vào kho mới, dev/các cổng sau chuyển server, hoặc thao tác dữ liệu thật. Không chạy `npm run dev` theo ghi chú cuối đặc tả, không khẳng định cổng cũ đã dừng. Truy vấn đọc listener bị môi trường hạn chế không trả bằng chứng hữu ích, không dùng để kết luận.

Claude cần chạy tại môi trường cho phép spawn:

```powershell
cd D:\Website_3Q\Webstie
npm.cmd run build
npm.cmd test
cd server
$env:SALE_AI_E2E='1'
npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts
Remove-Item Env:SALE_AI_E2E
cd ..\BossTele
npm.cmd test
```

Sau khi Claude chủ động chuyển server theo thời điểm Bảo chọn: kiểm tra chỉ dùng lõi trong cổng 4000, mở Sale AI ở 8787, lịch sử mới, reload chỉ đọc Kiot + Kiểm thử, đo dung lượng và độ trễ với phiên thật. Không gửi commit/restore giá thật để nghiệm thu task này.

## SHA-256 từng file chép

`TASK-104-source-hashes.json` giữ nguyên snapshot hash lần chép 29/10, không ghi đè lịch sử. `TASK-104-current-hashes.json` bổ sung hash nguồn hiện tại và hash bản tích hợp ngày 30/10, đánh dấu file khác nhau; dùng khi đồng bộ sửa lỗi TASK-103. pricing.js đã thay theo TASK-105 sau lần chép cũ, nên lấy nguồn hiện tại làm chuẩn; không quay lại hash pricing cũ.

Danh sách dưới là **SHA-256 nguồn hiện tại** của từng file được chép (test đã chỉnh import nên hash tích hợp có thể khác; xem JSON). File mới retention/store-cleanup/runtime không được gán hash nguồn giả.

```text
lib/batch-joint.js  95837c0ff65f201ead8876fc5587f26c8fe9cf180ce70066c7b38ba9c442330c
lib/batch-update.js  d1b6e5b7286dc60124b91e6a9cc531691d441b50355ba0e17f3322b870103780
lib/cycle.js  ba2584b54dcacb025791c58c2aa34512fa1547c798e375010bb6f074ac3a38fe
lib/fake-sync.js  c58b3dac27f05b2970afbf2e0346781d1f155f43161c17a7bffa3092b21e1cb8
lib/joint-update.js  2ac86e8d555ff8653e69d5088d81a1a9cf90008c02e00a7aa02b5cb85eb525c2
lib/kiot.js  420c5a8c7c92937e81b63633d2333685a955dd5c96b2719e7978fb87a4701b13
lib/live-draft.js  95059fce69dbc076c1fe20bc1969f8396230ea4adf0325d92cb10ea69905e75f
lib/live.js  d307ce3ea5776bfd4f6b3e25a8f9a7766c7b36069098e4f7ea6f2003fcc78a27
lib/manual-pricing.js  d0b5f6b1f4ff6514d6e1c45195ac3aaba63ac6e80736716d3bb62172e35e4735
lib/pricing.js  372828bac67453cecd734fe9d941056296d8221c70362969b385b52b7cf57133
lib/read-pool.js  894116a94d7203122987b3c20d15d6b0ceab2ad6f12e68e03378c501cbc33391
lib/restore.js  2e79bb8117236813c8795dcec3b5d2d9e542f24274dbffaa770861269bd1d06f
lib/samples.js  4b47af63ca61007e96e268d1efd05190f7a0a6da1eb9bc0a2a5ed4ed44b365cc
lib/sapo.js  0eb2d8b600d36ebaf692f74c7d7c15cbefbe2f27813e44b11f1871de9dbe0444
lib/service.js  5abc61511c3c945aa46edd5d5aae9b5a31284019e6ca6be9b2f2eb17e5d3df64
lib/shared-catalog.js  d806c8fce157b19cc70b2e019cdcad2b6dae8b3dd248c6d42e45d8012c7f383c
lib/split-store.js  6daeef7a5a61bb135b08a2f4aa1e76dee3f62eae1128a746bb757b9861096aa6
lib/store-lock.js  d28345d9a7c592e635fe2e30bcb138e51fd3d2f37095ae8c587ec5faf5f081bf
lib/store.js  ee2769488aefb725e77c504e2d40347c2eae663748d3a1569bb87efa8549473b
lib/update-errors.js  d23f88399d1df1993241a4a2f8b6b9e02dcd24e155203c843e73e749ad5f1709
lib/update-report.js  96f2eeaae753840bd6a0ab162fc39a1a3ffc5ff53640f0c2672ecff823dd2471
lib/view-data.js  cb997a4ae4d048f1ef04d84a5c38302d62fa9c6358fe7ec74ee5672951100ce8
public/age-cell.js  d101577aa33a719aeb16df9bd68eaee21afac0afeea690ffa5b0b6cf4fa494c8
public/app.js  6d63a2e08cae800c4720a3dc41c46979efef0d37d6b3afe5eca4b437d8e2de8b
public/history-model.js  73c095f3947510b0d8915cd1eb387f5db9e5bda2eea40d98ebb0ad59bd54861b
public/index.html  705fcdf3630273d0a7183454eb3ccc3122aa3f73f061b2d4f6692435fa5157da
public/live-ui.js  99290dea7c84dde68082f8e8312ebf0bea92a2706fd960c4ea892f2cda250a21
public/style.css  5b5062349d33204adddae7adcbc7d3bb775d0407b8d9fc5d1e4ef2ad49315168
test/access-token.test.js  30fa3d837550af28054520befca2440d894cf142008bf91c6866fd7b55e6be31
test/auto-table.test.js  9f10331d067085ef23097248e9a708f0742d4faa64f6bf2e4d8a68c42850ea8e
test/batch-joint.test.js  593dbda886e13b1bbdb5869ae1ccde9cde1faa56b63d665fcd29a075553a5133
test/batch-update.test.js  b6a8217a5cd5ab2b338d73d6bb8647c800881201344b9cd059b33237b2c40428
test/continue-update.test.js  426f6edecd06d90952d54a8a35d19a4b40dfd213acf970c0750c9ee8900a9967
test/cycle.test.js  792a2d5a4a1392f1716c913f2735053a4e5bf8376a000dcb8d8413f9e9a9490c
test/fifteen-days.test.js  b5e78b134323e455b42f011ddbc1e8aa2d4e70f6da621b20850c27a6fe020968
test/history-model.test.js  eebff538fbd25825b626248a1b9efe43bb95b8d6d0c39e2ef089e2f2508f7c2d
test/joint-update.test.js  ce5d11a7b52f9b747a4222bc14bf3611d740cd0be46db9a201ae500639aea9de
test/journal-window.test.js  364251ae153f7f8177abe3dcf0c33286b9bf818bea5c7c33d830a9d87111a5c8
test/jul-batch.test.js  8a958a51e7fd132ee81a17e59d45e6abfa5630542c4725a1982f491a19baadc8
test/kiot-errors.test.js  865515b4caaef35520e78ed86db2d52fbbbf1354ad43146956b56e209fbbd219
test/live-timing.test.js  8bcde2aabb247732df0cd68ac160b7af26c58ab6ea0109da1eea29a4912de0fa
test/live.test.js  c0b20e329732410bb4d57894db98cca06587e37153a91618925da230ff2dcf16
test/m-filter.test.js  48d9c985ca261d7cbe90d4e2d23ef4473092953bebf07ece63395442cd8b3661
test/mac-launch.test.js  87a4697033683f40179011be8ec6f40fce84844a6299ed25f2d9414667a413cc
test/manual.test.js  6c8d21551faf4303860d0159fc61581bd3b8527748d8291c575ae65de589402e
test/note-first.test.js  8336c3f451b03dd34fedb1b70b37c1ae884d50ea9b3f3974efa3681c8da53c6b
test/preoct-m1.test.js  558cdd18564857618475352d8b890af85c1ab5731ce902bab9ba3d454c9f7927
test/restore-joint.test.js  51cf85e0b5fb90749b342d912b2f832ad85a55f5e2f001ca73e9eec90fd742be
test/sapo.test.js  2009785c6e51e26a0f9af67fef8aaa979cbbf0b58d94005719dad593f0ae2bf4
test/shared-catalog.test.js  69c1194b9a4b5adf4ab693b9ade5c898ffcfe01ed92b7dbb06af00a94b527f04
test/simulator.test.js  a6f1df9903a353689b9c5a32817f31325ec8f447051e3fc229b5024087cd875a
test/split-store.test.js  4213ca280e67610b6670b37e4a0ca81ec1718429a194d101eb8c4019006bec60
test/start-date.test.js  bfcd099372c4935fe212da4472146c068e0047e3a06cf1ca1c4863c8ee70735a
test/table-write-sync.test.js  19918126ec77292d717590627d6dd77b5d662393389512fb3a85689d18466fcb
test/update-performance.test.js  b93d3a039e183438a3f2f4bb75ccd4f264e0f08ab7c8365d592eaae318bcbca2
test/view-performance.test.js  c86c86ca278c84992b8c777297f4e07db82192ab3c392eeb695f945a1b9723c2
```

## Phụ lục: bằng chứng mục 1.2 ngày 29/10, trước quyết định cho làm tiếp

Giữ lại số liệu kiểm tra cục bộ ban đầu bên dưới. Điểm chặn khi đó đã được Bảo gỡ theo quyết định trong đặc tả; không phải trạng thái hiện tại của TASK-104.

## Bằng chứng mục 1.2

Nguồn: `D:\BaoQ-AI\data\kiot-state.store\manifest.json` và các blob thuộc hai chỉ mục `updates`, `prepared`.

- SHA-256 manifest: `0c39cfe96b0cea4616355fae23f43409633d1d65286c2b81790302c7c0367cfd`.
- Đọc được 75 lượt `updates`, 1 bản `prepared`.
- Đã kiểm tra SHA-256 nội dung của 78 blob được đọc, khớp tên tham chiếu; không mở kho bằng `SplitStore.read()` vì phương thức đó có thể tạo khóa/ghi dấu kích hoạt.
- Có 65 kết quả nền tảng trong các lượt `joint-v1` có `status === 'done'` và không phải `alreadyOk`.
- 57 kết quả có lượt `restore-joint-v1` cùng `sourceId`, thời gian sau lượt ghi, cùng SKU, cùng nền tảng, trạng thái `done`, không `skipped`.
- 8 kết quả còn lại thuộc 4 lượt dưới đây, đều là SP000009 và đều có `requestSent: true` trên cả Kiot và Sapo:

1. `66be16f6-aea5-4ed1-b5bb-f175a1e38bf2`, `2026-10-10T05:52:04.142Z`.
2. `84c40b24-119b-43e8-8db3-ea9dab0afba0`, `2026-10-10T06:00:38.520Z`.
3. `152eb2b0-4192-4907-b1b9-52a346854474`, `2026-10-10T06:08:15.644Z`.
4. `a67abbf7-e277-473d-91de-1b6aadbcfa3d`, `2026-10-11T05:41:32.639Z`.

Không chỉ dựa vào thiếu `sourceId`: đã đối chiếu thêm mọi lượt `restore-joint-v1` sau đó có SP000009 được khôi phục thành công. Không tìm thấy `restoreTasks` Kiot có `target.currentPrice` **và** `target.notes` cùng khớp bản `before` của cả bốn lượt này. Với lượt `152eb2b0-4192-4907-b1b9-52a346854474`, cũng không tìm thấy bản đích Sapo khớp toàn bộ `sapo.before` bằng `isDeepStrictEqual`. Đây là kiểm tra snapshot trong nhật ký, không phải bằng chứng trạng thái ngoài hệ thống.

Ví dụ cần tránh kết luận nhầm: lượt `2fcdf2ff-dca5-4604-8fa7-24d468f21942` khôi phục nguồn `c1b43518-9ab6-4799-8c7b-612487550c39` về 3.900.000đ, không phải giá 5.000.000đ trước lượt `a67abbf7-e277-473d-91de-1b6aadbcfa3d`. Những lượt sau nữa có khôi phục về 5.000.000đ, nhưng so khớp giá đơn lẻ không đủ xác nhận phần nội dung.

