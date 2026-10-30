# TASK-111 — Kết quả dọn code cũ

- Dự án: web + BossTele.
- Người thực hiện: Codex. Ngày: 30/10/2026.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai, chạy kiểm tra trong sandbox và ghi các giới hạn bên dưới.
- Bước tiếp theo: Claude chạy lại build/test mặc định, xóa thư mục bị từ chối truy cập và kiểm tra trình duyệt theo spec. Có rà soát chỉ đọc bổ sung bằng subagent, không phát hiện blocker; chưa có review/kiểm chứng độc lập của Claude, không ghi `verified`.

## Thay đổi

1. `Webstie/server/src/sale-ai/public/app.js`: `postMessage` chỉ gửi tới `location.origin`.
2. Thay máy chủ chép cũ bằng `sale-ai/test/http-fixture.js`: helper chỉ chuẩn bị dependency cách ly và `http.createServer(core.handler)`; route/nghiệp vụ thực thi `createSaleAi` trong `core.js` thật. Store mặc định trong bộ nhớ; client mặc định từ chối gọi ngoài; Sapo mặc định không kết nối. Test adapter Kiot có fetcher giả riêng dùng thư mục tạm ngoài kho ứng dụng.
3. Chuyển 8 file test nghiệp vụ còn dùng bản chép sang helper trên; test từ chối cấu hình fixture gọi trực tiếp `createSaleAi`, không để helper bổ sung dependency làm mất ý nghĩa từ chối.
4. Test token của máy chủ riêng được thay bằng một test trong `server/src/tests/saleAiProxy.test.ts`: người chưa đăng nhập/thiếu `sale.manage` không đến core thật, header token không vượt được quyền website, người có quyền nhận trạng thái core. Hai assertion Origin trong manual/simulator chuyển về test middleware website; test đó kiểm cả commit, run, manual-price và xác nhận core chưa được gọi. Không thêm lớp bảo vệ giả vào helper HTTP.
5. Gỡ import/mount API sản phẩm SQLite khỏi `server/src/app.ts`; giữ catalog, `healthRouter`, `products.view`, `products.cost`. Sửa dòng API cũ trong `Webstie/README.md` sang catalog hiện hành.
6. `BossTele/AGENTS.md`, `BossTele/CLAUDE.md`, `BossTele/docs/SALE-PRICE.md`: cập nhật nguồn `../server/src/sale-ai/lib/pricing.js`, kho `../server/data/sale-ai/kiot-state.store`, quy tắc TASK-105/TASK-109, ví dụ và nơi chạy test. Không thay code tính giá BossTele.
7. `core.js`: bỏ tham số `accessToken` không được đọc và không có caller truyền vào, còn sót từ máy chủ riêng. Không thay thuật toán, ghi giá hoặc lịch.
8. `sale-ai/lib/shared-catalog.js`: gỡ `useWebCatalog` và cấu hình `BAOQ_WEB_URL` riêng của adapter máy chủ độc lập. CodeGraph và tìm caller cho thấy sau khi gỡ bản máy chủ chép, chỉ còn test gọi adapter; `runtime.ts` đã cung cấp `client.all` trực tiếp qua `catalogStore`. Giữ `rawFromWebRow` và test ánh xạ vì runtime đang dùng. Gỡ 2 test chỉ dành cho adapter HTTP/fallback đã nghỉ dùng. Giữ API `/internal/catalog/sync` và test bảo vệ của nó: chưa đủ bằng chứng loại trừ người gọi nội bộ ngoài repo, nên không mở rộng xóa endpoint này. `internalRouter` còn phục vụ trợ lý.

## File đã xóa và bằng chứng

| File dưới `Webstie/server/src/` | Bằng chứng/phạm vi |
|---|---|
| `routes/productRoutes.ts` | Chỉ được mount bởi `app.ts`; frontend hiện hành không gọi API đã gỡ. |
| `controllers/productController.ts` | Chỉ route trên import `getProducts`. |
| `models/productModel.ts` | `findProducts` chỉ được controller trên và test API riêng sử dụng. |
| `tests/products.test.ts` | 8 ca thực thi dành riêng API đã được spec cho phép gỡ (4 ca cookie tham số hóa + 4 ca thường). |
| `models/userModel.ts` | Tìm tên module và các export không có import/caller ngoài chính file. Model xác thực đang dùng nằm ở nơi khác và được giữ. |
| `sale-ai/test/legacy-server.js` | Tất cả import đã được chuyển; không giữ bản sao route/core. |
| `sale-ai/test/access-token.test.js` | 1 test được thay tại lớp website hiện hành, như mô tả trên. |
| `sale-ai/test/scripts/mac-launch.mjs` | Launcher máy chủ riêng được spec yêu cầu gỡ. |
| `sale-ai/test/mac-launch.test.js` | 5 test chỉ kiểm launcher vừa gỡ, không kiểm nghiệp vụ nhúng; không còn module để chạy. |

Không có `services/productService.ts` trong checkout: controller gọi thẳng model, nên không có service riêng để xóa. Đã dùng CodeGraph trước khi dò code; đối chiếu caller bằng `rg` khi truy vấn không trả các file mục tiêu. Đã đọc audit Claude được spec dẫn và review TASK-110 để giữ phạm vi.

Đã xóa `sale-ai/data/` sau khi xác nhận rỗng, và thư mục `sale-ai/test/scripts/` sau khi xóa launcher cuối cùng. Đây là thư mục dưới `src`, không phải kho `server/data/`.

**Bảng `Product` được giữ để Bảo quyết định sau:** không thay `prisma/schema.prisma`, không tạo migration và không có thao tác xóa bảng/dữ liệu. Không kết nối DB để kiểm tra dữ liệu thực tế.

## Số test trước/sau

Hai file `TASK-111-test-counts-before.json` / `TASK-111-test-counts-after.json` ghi số khai báo `test(...)` theo file, khác số ca chạy do các vòng lặp tham số hóa.

| Phạm vi | Trước | Sau | Giải thích |
|---|---:|---:|---|
| `auto-table.test.js` | 5 | 5 | Giữ nghiệp vụ, chạy core thật. |
| `cycle.test.js` | 3 | 3 | Như trên. |
| `joint-update.test.js` | 21 | 21 | Như trên, giữ kiểm tra từ chối fixture. |
| `live-timing.test.js` | 1 | 1 | Giữ Kiot adapter với fetcher giả. |
| `m-filter.test.js` | 3 | 3 | Giữ bộ lọc/chọn tất cả. |
| `manual.test.js` | 5 | 5 | Origin chuyển về middleware website. |
| `simulator.test.js` | 13 | 13 | Origin chuyển về middleware website. |
| `view-performance.test.js` | 2 | 2 | Giữ revision, checkpoint, ETag. |
| Token cũ → test website mới | 1 | 1 | Đổi từ token máy chủ riêng sang đăng nhập/quyền website. |
| Launcher Mac đã gỡ | 5 | 0 | Chức năng được spec yêu cầu gỡ. |
| `shared-catalog.test.js` | 3 | 1 | Giữ test mapper; gỡ 2 test adapter máy chủ riêng không còn caller runtime. |
| Toàn bộ khai báo Node test lõi | 198 | 190 | Giảm 5 launcher + 2 adapter + 1 chuyển sang Vitest. |
| Node test lõi thực thi, cùng tiến trình | 212 đạt | 204 đạt | 0 lỗi, 0 bỏ qua cả hai lần. |
| API sản phẩm SQLite riêng | 8 | 0 | Gỡ đúng API và test riêng theo spec. |
| `saleAiProxy.test.ts` | 3 | 4 | Thêm test thay token; mở rộng assertion Origin trong test hiện có. |

Spec/audit ghi 10 file import bản chép, nhưng liệt kê 9 tên và checkout thực tế có 9 file: 8 file giữ nguyên số test, 1 file token chuyển sang website. Không giảm số test nghiệp vụ của 8 file đó. Chạy `--test-isolation=none` dùng chung module cache, nên số ca không so trực tiếp với số của runner cách ly từng file (các test import fixture từ file test khác có thể được đăng ký lặp ở chế độ cách ly).

## Bằng chứng chạy lệnh

| Lệnh và nơi chạy | Kết quả thực tế | Log trong `tasks/` |
|---|---|---|
| `node --test src/sale-ai/test/*.test.js`, server, trước sửa | Bị `spawn EPERM` khi tạo tiến trình test. | `TASK-111-core-before.log` |
| `node --test --test-isolation=none src/sale-ai/test/*.test.js`, server, trước sửa | 212/212 đạt. PowerShell ghi stderr của cảnh báo dọn blob thành NativeCommandError và trả exit 1; runner ghi 0 lỗi. | `TASK-111-core-before-inprocess.log` |
| Lệnh cùng tiến trình trên, sau chuyển đổi, trước gỡ adapter HTTP không dùng | Exit 0; 206/206 đạt, 0 bỏ qua, khoảng 90,6 giây. | `TASK-111-core-after.log` |
| Lệnh cùng tiến trình trên, sau gỡ adapter, bản cuối | Exit 0; 204/204 đạt, 0 bỏ qua, khoảng 64,1 giây. | `TASK-111-core-final.log` |
| Chạy riêng 8 file chuyển đổi, cùng tiến trình | Lần đầu 52 đạt/1 lỗi: helper bổ sung client làm mất kiểm tra cấu hình không hợp lệ; đã sửa test đó gọi thẳng core. Toàn bộ suite sau sửa đạt như trên. | `TASK-111-migrated-tests.log` |
| `node --test --test-isolation=none src/sale-ai/test/joint-update.test.js src/sale-ai/test/live-timing.test.js`, server, sau thay đổi cuối trong core | Exit 0; 22/22 đạt. | `TASK-111-final-focused.log` |
| `npm.cmd run build`, Webstie | Build server và typecheck frontend qua; Vite bị `spawn EPERM` tại esbuild. Không gọi toàn bộ build là đạt. | `TASK-111-build.log` |
| `npm.cmd run build --workspace server`, Webstie, sau thay đổi cuối | Exit 0; tsc và copy Sale AI đạt. | `TASK-111-server-build.log` |
| `npm.cmd run typecheck`, frontend | Exit 0. | `TASK-111-frontend-typecheck.log` |
| `npm.cmd test`, Webstie | Playwright bị `spawn EPERM`; chuỗi chưa chạy tới test server. | `TASK-111-web-test.log` |
| `npm.cmd exec --workspace server -- vitest run`, Webstie | Bị `spawn EPERM` lúc esbuild nạp config; chưa chạy Vitest, gồm test website vừa cập nhật. | `TASK-111-server-vitest.log` |
| `npm.cmd test`, BossTele | Runner bị `spawn EPERM`. | `TASK-111-bosstele-test.log` |
| `node --test --test-isolation=none test/*.test.js`, BossTele | 139 ca: 110 đạt, 29 lỗi, 0 bỏ qua; cả 29 lỗi ở test CLI `add.test.js` gọi `spawnSync` bị EPERM. Không sửa/nới test. | `TASK-111-bosstele-inprocess.log` |
| `node tasks/TASK-111-guards-check.mjs`, gốc repo | Exit 0: 3 lượt từ chối truy cập, GET core thật, 3 POST khác Origin bị chặn trước core, POST cùng Origin thành công. Dùng middleware quyền/Origin đã build và core nguồn; xác thực là fixture, không phải phiên người dùng thật. | `TASK-111-guards-check.log` |
| `git diff --check`, gốc repo | Exit 0; chỉ cảnh báo chuẩn hóa LF/CRLF. | Output trực tiếp. |

## Quét tham chiếu và phạm vi giữ nguyên

- `rg -n '5173|4310|BaoQ-AI|legacy-server|/api/products' Webstie/server/src Webstie/frontend/src Webstie/scripts Webstie/BossTele --glob '!**/vendor/**' --glob '!**/.claude/**' --glob '!**/tasks/**'`: exit 1, không có kết quả, bao gồm cả file chưa track.
- `git grep` cùng các mẫu trên, loại lịch sử/skill/vendor: chỉ còn 2 dòng trong **AGENTS.md gốc** và **CLAUDE.md gốc** yêu cầu tính số task theo kho lịch sử bên ngoài. Giữ vì đó là hướng dẫn lưu trữ hiện hành của người dùng, không phải tham chiếu runtime cũ. Không sửa các dòng này để làm đẹp kết quả grep.
- Không thay schema/migration, quyền sản phẩm, health route, vendor, client backup, kho dữ liệu hoặc kho lưu trữ bên ngoài. Không gọi cập nhật/khôi phục thật, không bật batch, không cài dependency.
- Không dừng/khởi động lại server hiện hành, không commit, không hoàn tác thay đổi của task khác. HTTP test chỉ dùng máy chủ thử nghiệm cổng ngẫu nhiên của chính test.
- Bản đồ repo cấp thư mục không đổi: không thêm/xóa thư mục chức năng nào trong danh sách AGENTS.md.

## Còn lại do sandbox và chưa xác minh

Windows từ chối xóa thư mục rỗng sau (Access denied), đã dừng dọn chuỗi này, không xin quyền:

```text
D:\Website_3Q\Webstie\scripts\.task020-test-e1a73ff4fe4d496bbef0804bd386e034\temp\baoq-db-7829a738107e4a17923340a5099af943
D:\Website_3Q\Webstie\scripts\.task020-test-e1a73ff4fe4d496bbef0804bd386e034\temp
D:\Website_3Q\Webstie\scripts\.task020-test-e1a73ff4fe4d496bbef0804bd386e034
```

Kiểm kê trước xóa: chỉ các thư mục, không có file dữ liệu. Không còn file mã cần xóa bị chặn.

Claude cần chạy lại `npm run build`, `npm test` tại Webstie và `npm test` tại BossTele trong môi trường cho phép spawn; sau đó kiểm đăng nhập 8787, Sale AI và Tài liệu theo spec. Phiên này không kiểm trình duyệt, tài khoản thật, ghi giá/rollback thật hoặc hành vi sau khi restart.
