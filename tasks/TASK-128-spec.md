Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-128: Tách code dùng chung ra `Webstie/shared/`, dọn chỉ mục CodeGraph, giữ test BossTele riêng

- Dự án: web + BossTele
- Người phụ trách: Codex (làm), Claude (chạy test, review)
- Trạng thái: `ready`
- Hành động gần nhất: 03/11/2026, Claude viết đặc tả theo yêu cầu của Bảo sau bản đánh giá cấu trúc code.
- Bước tiếp theo: Codex làm, ghi `TASK-128-result.md`; Claude review vào `TASK-128-review.md`.

## Yêu cầu của Bảo (03/11/2026)

1. "Gom phần dùng chung (khóa kết nối, tra sản phẩm) vào một thư mục chung có test riêng."
2. "Sửa đường dẫn trong codegraph.json, loại thêm tasks/, xóa bản backup."
3. "Tui muốn tắt test chung với toàn bộ dự án, khi nào lỗi BossTele thì tui mới muốn test nó riêng." Nghĩa là **không** đưa test BossTele vào `npm test` chung.

## Hiện trạng

Server web đọc thẳng file trong `Webstie/BossTele/lib` bằng đường dẫn tương đối:

| Nơi gọi | File BossTele được dùng |
|---|---|
| `server/src/services/catalogSearchService.ts:38-41` | `product-search.js` (`createProductSearch`), `connection-config.js` |
| `server/src/services/catalogStore.ts:140-143` | `product-search.js` (`createCatalogFetcher`), `connection-config.js` |
| `server/src/sale-ai/runtime.ts:21-22` | `connection-config.js` |
| `server/src/services/assistant/tools.ts:18` | `target-price.js` (`calculateTargetPrice`) |

Phía BossTele, các file gọi chúng: `chat.js`, `search-products.js`, `telegram-bot.js` (dòng 11, 13). `target-price.js` có test trong `BossTele/test/chat.test.js`.

Test chung hiện tại: `npm test` tại `Webstie/` = frontend + server (Vitest + `test:sale-ai`). BossTele **đã không** nằm trong test chung; giữ nguyên.

## Yêu cầu

### 1. Thư mục `Webstie/shared/`

- Chuyển 3 file vào đây (dùng `git mv` để giữ lịch sử): `connection-config.js`, `product-search.js`, `target-price.js`. Giữ CommonJS và nội dung, chỉ sửa đường dẫn `require` nếu có.
- Không để lại file chuyển tiếp trong `BossTele/lib`. Sửa mọi nơi gọi trỏ thẳng tới `shared/`:
  - BossTele: `require('../shared/...')` hoặc tương đương;
  - Server: gom việc nạp 3 module này vào **một** file, ví dụ `server/src/config/shared.ts`. File này tính đường dẫn tới `Webstie/shared/` đúng cho cả `src/` và `dist/`, và trả về hàm nạp cấu hình kết nối đã gắn sẵn thư mục chứa `.env`. 4 nơi gọi ở bảng trên chỉ import từ file này.
- Khóa vẫn đọc từ `Webstie/BossTele/.env` như hiện tại (đường dẫn này chỉ ghi ở file gom trên). **Không** chuyển, chép hay in khóa.
- Test riêng: `Webstie/shared/test/*.test.js` (node:test).
  - Chuyển các test của 3 module từ `BossTele/test` sang: `connection-config.test.js`, `product-search.test.js`, `product-search-detail.test.js`, `catalog-fetcher.test.js`, và phần test `target-price` trong `chat.test.js`.
  - Không bớt hay nới lỏng test nào.
- `Webstie/shared/package.json` có `"test": "node --test test/*.test.js"`.
- Build server phải chạy được khi chỉ có `dist/` cạnh `Webstie/shared/` (không chép shared vào dist, trừ khi cần thì ghi rõ lý do trong result).

**Giả định cần Bảo xác nhận khi review:** test `shared/` **được** chạy trong `npm test` chung, vì web phụ thuộc trực tiếp vào nó (khác BossTele). Thêm vào script `test` của `Webstie/package.json`.

### 2. Chỉ mục CodeGraph và Serena

- `D:\Website_3Q\codegraph.json`:
  - `exclude`: sửa `BossTele/.claude/skills/` → `Webstie/BossTele/.claude/skills/`, `BossTele/vendor/` → `Webstie/BossTele/vendor/`; thêm `tasks/` và `Webstie/BossTele/tasks/`.
  - Bỏ mục `deprioritize` nếu không còn gì trong đó.
- `D:\Website_3Q\.serena\project.yml`: thêm `"tasks/**"` vào `ignored_paths`, giữ các mục đang có.
- Xóa thư mục `tasks/TASK-110-backup/` (`App.jsx`, `task-015-preview.html`; đã có trong git nên khôi phục được). Ghi chú một dòng ở cuối `tasks/TASK-110-result.md` rằng bản sao đã xóa theo TASK-128.
- Chạy lại index CodeGraph và ghi số file trước/sau vào result. Trước: 332 file, trong đó 69 file `Webstie/BossTele/.claude/skills`.

### 3. Test BossTele

- Không thêm BossTele vào `npm test` chung.
- Ghi rõ vào `tasks/README.md` (mục Website sau TASK-110 hoặc mục mới): test chung gồm frontend, server, Sale AI và `shared/`; BossTele chạy riêng bằng `npm test` tại `Webstie/BossTele` khi sửa BossTele hoặc bot lỗi.
- Cập nhật `AGENTS.md` nếu có chỗ ghi đường dẫn `BossTele/lib/connection-config`, `product-search`, `target-price` hay mô tả test chung.

## Ngoài phạm vi

- Không đổi logic tra sản phẩm, cấu hình kết nối hay công thức giá.
- Không đổi tên thư mục `Webstie`. Không tách `telegram-bot.js`.
- Không chuyển `.env` hay khóa sang chỗ khác.
- Không đụng `Webstie/BossTele/vendor/`, `.claude/skills/`, dữ liệu trong `server/data/`.

## Vùng code

- **Điểm vào:** 4 file server ở bảng Hiện trạng; `BossTele/chat.js`, `BossTele/search-products.js`, `BossTele/telegram-bot.js`; `BossTele/lib/{connection-config,product-search,target-price}.js`.
- **Phạm vi ảnh hưởng:**
  - `server/src/routes/internalRoutes.ts` (dùng catalogStore);
  - `server/src/tests/` có mock các module này (grep `product-search`, `connection-config`, `target-price`, `catalogStore`, `catalogSearch`);
  - `BossTele/catalog.js`, `BossTele/sale-price.js`;
  - script build server (cách chép file JS sang `dist/`).
- **Test liên quan:** test mới trong `shared/test`; `server/src/tests/*` (catalog, assistant, internal API); toàn bộ `BossTele/test`.
- **Không đụng:** xem Ngoài phạm vi.

## Tiêu chí nghiệm thu

1. Không còn chuỗi `BossTele/lib` trong `Webstie/server/src` (trừ chú thích lịch sử nếu cần).
2. `grep` không còn file `connection-config.js`, `product-search.js`, `target-price.js` trong `BossTele/lib`.
3. Tại `Webstie/`: `npm run build` đạt, `npm test` đạt và có chạy test `shared/`.
4. `npm test` tại `Webstie/shared` đạt; số test bằng tổng các test đã chuyển (ghi số trước/sau trong result).
5. `npm test` tại `Webstie/BossTele` đạt, số test = số cũ trừ số đã chuyển.
6. `npm run dev`: bot BossTele trả lời tra sản phẩm được, trang Tìm kiếm sản phẩm và Sale AI đọc được Kiot. Phần này Claude kiểm tra khi review nếu môi trường cho phép.
7. `codegraph status` không còn file trong `Webstie/BossTele/.claude/skills`, `tasks/`; `tasks/TASK-110-backup/` đã xóa.

## Lệnh kiểm tra

```
cd D:\Website_3Q\Webstie && npm run build && npm test
cd D:\Website_3Q\Webstie\shared && npm test
cd D:\Website_3Q\Webstie\BossTele && npm test
cd D:\Website_3Q && codegraph index && codegraph status
```

Nếu sandbox chặn chạy test (spawn EPERM), ghi rõ trong result, không xin quyền; Claude sẽ tự chạy.
