Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-131 — Kết quả gom hàm dùng chung

- Dự án: web và BossTele.
- Người triển khai: Codex.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: triển khai và kiểm tra cục bộ ngày 03/11/2026.
- Bước tiếp theo: Claude kiểm tra độc lập, chạy lại các lệnh chuẩn và kiểm thật ở môi trường cho phép.

## Thay đổi

- Tạo `Webstie/shared/text.js` với `fold` đúng công thức đặc tả; thay đủ 13 bản chép. `brands.ts` vẫn export `fold` có bước bỏ dấu câu/trim; `pricing.ts` dùng alias `light` của shared để giữ `%` và số thập phân.
- Chuyển nguyên nội dung `BossTele/lib/sku.js` sang `shared/sku.js`; xóa hai bản cũ `BossTele/lib/sku.js` và `server/src/services/assistant/sku.ts`. Các nơi gọi dùng shared.
- Tạo `shared/money.js` với `vnd`, `tr` đúng định dạng cũ. Giữ nguyên biến tỷ giá `vnd` trong `exchangeRates`, các định dạng tiền khác và cách đọc tiền.
- Bổ sung sáu export tại `server/src/config/shared.js` qua `createRequire`, có JSDoc, không dùng `any`; `matchingSkus` giữ generic `<T extends { sku: string }>(items: T[], sku: string) => T[]`.
- Giữ các comment hiện có, không thêm dependency. Không sửa logic nghiệp vụ hoặc kỳ vọng test. Hai test SKU chỉ đổi đường dẫn import; không chuyển test SKU sang shared.

## File thuộc thay đổi TASK-131

- Mới: `Webstie/shared/text.js`, `Webstie/shared/money.js`, `Webstie/shared/sku.js`, `Webstie/shared/test/text.test.js`, `Webstie/shared/test/money.test.js`.
- Server: `Webstie/server/src/config/shared.js`; `Webstie/server/src/services/assistant/{brands,graph,pricing,router,tools}.ts`; `Webstie/server/src/services/catalogStore.ts`; `Webstie/server/src/tests/assistantSku.test.ts`.
- BossTele: `Webstie/BossTele/{catalog,telegram-bot,sale-price}.js`; `Webstie/BossTele/lib/{boss-memory,buy-price,listing-draft,market-lookup,price-feedback,telegram-product-guard}.js`; `Webstie/BossTele/test/sku.test.js`.
- Xóa trong task: `Webstie/BossTele/lib/sku.js`, `Webstie/server/src/services/assistant/sku.ts`.
- Tài liệu: `tasks/TASK-131-plan.md`, `tasks/TASK-131-spec.md` (trạng thái/bàn giao), báo cáo này.

Working tree đã có nhiều thay đổi trước phiên, kể cả trong một số file trên; danh sách này chỉ nhận phần gom hàm/import của TASK-131. Không commit, không đổi nhánh, không sửa frontend, Sale AI, vendor, v2, backup hoặc dữ liệu vận hành.

## Kiểm tra thực tế

1. Trước khi tạo module: `node --test --test-isolation=none Webstie/shared/test/text.test.js Webstie/shared/test/money.test.js` từ gốc repo thất bại đúng vì thiếu `../text` và `../money`. Sau triển khai, cùng lệnh đạt **4/4**.
2. Tại `Webstie/shared`: `node --test --test-isolation=none test/*.test.js` đạt **32/32**. Bao gồm test mới về dấu tiếng Việt, đ/Đ, chữ hoa, null/undefined, số, dấu câu, tiền âm, làm tròn và hậu tố tiền.
3. Tại `Webstie/BossTele`, lệnh sau đạt **82/82**, không sửa test hoặc kỳ vọng:

   ```powershell
   node --test --test-isolation=none test/buy-price.test.js test/catalog.test.js test/chat.test.js test/close-price.test.js test/listing-draft.test.js test/market-lookup.test.js test/sale-price.test.js test/sku.test.js test/stock-gap.test.js test/telegram-access.test.js test/telegram-bot.test.js test/telegram-product-guard.test.js
   ```

4. `npm.cmd run build --workspace server` tại `Webstie`: **đạt**, gồm TypeScript và hai script copy. Sau lần chỉnh import cuối đã chạy lại lệnh này thành công.
5. Kiểm tra Node nội tuyến dùng `assert` và VM với nguồn trước khi sửa lưu tạm: **888 phép so sánh Buffer UTF-8 đạt**, bao gồm 12 định nghĩa fold/light cũ và 3 định nghĩa tiền cũ còn trong snapshot; các chuỗi sinh bằng mã Unicode phủ 65.536 code unit BMP. Snapshot của `telegram-bot.js` được lấy lại ở lượt sửa import SKU nên không dùng nó để tuyên bố đối chiếu trước/sau các hàm fold/tiền của file này. Các công thức cũ của Telegram được đối chiếu nguồn và các test hiện có đạt; đây chưa phải chứng minh toàn bộ hội thoại thật giống từng byte.
6. Node nội tuyến xác nhận hai test SKU chỉ khác import; 12 file CommonJS được kiểm bằng `vm.Script` không lỗi cú pháp; mọi dòng comment của các file sửa có trong snapshot được giữ lại; hai đường dẫn SKU cũ không còn.
7. Import cả `server/src/config/shared.js` và `server/dist/config/shared.js`: sáu hàm có cùng tham chiếu; kiểm đầu ra bỏ dấu, SKU và tiền đạt. Lần thử đầu dùng chữ Việt trong here-string bị PowerShell chuyển thành `?`; đã chạy lại thành công với Unicode escape để kiểm đúng ký tự.
8. Nạp bộ lọc Telegram bằng đường dẫn tuyệt đối từ cwd gốc repo (ngoài BossTele) thành công; `storeQuestion` hoạt động. Không sửa hoặc khởi động plugin/bot.
9. Quét `normalize('NFD')` trong phạm vi nghiệm thu chỉ còn `Webstie/shared/text.js`. `extractSkus` chỉ định nghĩa tại shared; không còn khai báo formatter trùng trong bốn file được chỉ định. `git diff --check` trên các file sửa được theo dõi không phát hiện lỗi khoảng trắng; Git có cảnh báo LF/CRLF theo cấu hình checkout.

## Kiểm tra bị chặn và giới hạn

- `npm.cmd run build` tại `Webstie`: server build và frontend `tsc --noEmit` qua; Vite/esbuild không nạp được config vì **`spawn EPERM`**, exit 1. Chưa có full build đạt.
- `npm.cmd test` tại `Webstie`: bị chặn ngay ở shared do Node test runner **`spawn EPERM`**, exit 1; frontend/server/Sale AI trong chuỗi này chưa chạy.
- `npm.cmd test` tại `Webstie/shared` và `Webstie/BossTele`: đều exit 1 vì **`spawn EPERM`** trước khi chạy nội dung test theo cơ chế chuẩn.
- `npm.cmd run test --workspace server` tại `Webstie`: Vitest/esbuild bị **`spawn EPERM`** khi nạp config, exit 1; test lõi Sale AI phía sau chưa chạy.
- Chạy cả BossTele bằng `node --test --test-isolation=none test/*.test.js`: **112 test, 83 đạt, 29 lỗi**. Cả 29 lỗi thuộc `test/add.test.js`, đều có `spawnSync ... node.exe EPERM`: các nhóm `CLI success`, `rejects 0/1/3 arguments`, `rejects invalid value ... in either position`, `reports the first invalid argument only`, `rejects overflow for ±1e308`. Không sửa hay nới lỏng test để bỏ các lỗi này. Kết quả 82/82 ở trên chỉ là nhóm không chứa file CLI này.
- Kiểm thật các câu **“giá sale SP…”**, **“túi Chanel”**, **“mẫu hot chanel”**: **`blocked`**. Chưa có bằng chứng trước/sau trên cùng dữ liệu thật và full build bị chặn. Không bật bot Telegram vì chưa xác nhận bot máy kia đã tắt; không dùng test fixture thay kiểm thật. Claude cần kiểm trong môi trường được phép sau khi build.

Không yêu cầu cấp quyền vượt sandbox. Code đã triển khai; chưa được Claude kiểm tra độc lập, chưa đủ bằng chứng để ghi `verified` hoặc khẳng định toàn bộ hệ thống thật giữ nguyên từng byte.
