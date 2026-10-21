# TASK-027 — Kết quả triển khai

- Dự án: web (`server/`, `client/`). Người triển khai: Codex.
- Trạng thái bàn giao: **ready_for_review**; phần cài dependency và kiểm chứng đầy đủ **bị chặn bởi sandbox**. Chưa `verified`, chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: viết backend/UI/test/tài liệu; chạy lại selfcheck, client TypeScript và build; kiểm tra phạm vi diff.
- Bước tiếp theo: Claude cài đúng 4 dependency ở môi trường có mạng, ghi phiên bản thực tế, chạy build/test, tải cache embedding và review PDF/Claude thật theo spec.
- Không commit. Không sửa test cũ, DB, Prisma schema/migrations, `.env`, BossTele hoặc luồng Tìm kiếm/đăng nhập.

## Thay đổi

- `server/src/routes/documentRoutes.ts`, `controllers/documentController.ts`: API list/upload/delete/ask; xác thực, quyền riêng từng endpoint; rate limit `/ask` 20 lần/phút/user. Upload `express.raw`, chỉ `application/pdf`, tối đa 20 MiB, không nhận body nén; trả lỗi tiếng Việt.
- `server/src/models/documentStore.ts`: PDF theo UUID, metadata/chunks/vector ở `server/data/documents/index.json`; kiểm tra cấu trúc index bằng Zod; ghi file tạm rồi rename; tuần tự hóa mutation trong một tiến trình, rollback nếu commit index thất bại; list không trả chunks/vector. Tên upload không tham gia đường dẫn filesystem.
- `server/src/services/documentIngestService.ts`: kiểm tra `%PDF-`, tên URI-encoded; đọc chữ theo từng trang bằng unpdf, chunk 1000 ký tự/overlap 150; PDF không có chữ trả 422; audit `document.upload`/`document.delete` chỉ ghi actor/action/target ID, không ghi nội dung.
- `server/src/services/documentEmbeddingService.ts`: lazy-load pipeline `Xenova/multilingual-e5-small`, `dtype: q8`, mean pooling/normalize; passage/query prefix; cache ở `server/data/models/`, tuần tự inference, lỗi mô hình trả 503 an toàn.
- `server/src/services/documentRetrievalService.ts`: cosine, bỏ vector không hợp lệ/zero, top 6, giữ tên/trang; excerpt tối đa 200 ký tự.
- `server/src/services/documentQaGraph.ts`: LangGraph `retrieve → answer`, state `reply` để không trùng tên node; không lưu hội thoại/checkpointer. Claude SDK dùng `claude-opus-5-5`, effort low, không gửi thinking; system prompt cố định có cache_control. JSON context chứa tên/trang/text; response chỉ có answer/sources. Thư viện rỗng trả ngay, thiếu khóa trả 503; SDK APIError 429/5xx → 503, còn lại → 502; refusal lịch sự, không trả lỗi gốc.
- Chặn hỏi đáp trước khi import LangGraph nếu biến tracing/verbose đang bật: `LANGSMITH_TRACING`, `LANGCHAIN_TRACING_V2`, `LANGCHAIN_TRACING`, `LANGCHAIN_VERBOSE`. Không gửi tài liệu sang LangSmith hay log chi tiết. Không thay đổi `.env` để thực hiện điều này.
- `server/src/app.ts`, `config/env.ts`, `config/permissions.ts`, `services/auditService.ts`: gắn router, khóa Claude tùy chọn, nhãn audit; ADMIN có view/manage, MANAGER mặc định view, STAFF không có quyền tài liệu mặc định.
- `client/src/api/documents.ts`, `admin/views/Documents.jsx`, `admin/views/App.jsx`, `admin/styles.css`: mục Tài liệu, danh sách thật từ API, upload/xóa theo quyền, xác nhận xóa, trạng thái xử lý/lỗi/thử lại, hỏi độc lập và nguồn tên/trang. Trả lời bằng React text, giữ xuống dòng; abort request khi unmount; CSS scoped theo token tối/tím hiện có. Dùng icon `bag` sẵn có vì bộ icon chưa có `file`.
- `client/src/api/audit.ts`: nhãn hành động tài liệu trong bộ lọc nhật ký.
- `.gitignore`, `server/.env.example`, `AGENTS.md`, `PRODUCT.md`: loại `server/data/` khỏi Git, placeholder khóa, ngoại lệ Anthropic và cách dùng; cập nhật bản đồ thư mục.
- `tasks/TASK-027-plan.md`: kế hoạch/phạm vi. `tasks/TASK-027-selfcheck.mjs`: kiểm tra trực tiếp code nguồn bằng Node khi Vitest/esbuild bị chặn tiến trình con.

## Gói mới: cài đặt bị chặn, chưa có phiên bản cài thực tế

Đã chạy tại root, đúng workspace `server`, đúng 4 gói được duyệt:

```powershell
npm.cmd install --workspace server --save-exact --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000 @langchain/langgraph @anthropic-ai/sdk @huggingface/transformers unpdf
```

Kết quả exit 1:

```text
npm error code ENOTCACHED
request to https://registry.npmjs.org/@anthropic-ai%2fsdk failed:
cache mode is 'only-if-cached' but no cached response is available.
```

- `@langchain/langgraph`: **chưa cài; phiên bản chưa xác định**. Peer `@langchain/core` để npm tự giải quyết theo package; không chạy lệnh cài gói thứ năm.
- `@anthropic-ai/sdk`: **chưa cài; phiên bản chưa xác định**.
- `@huggingface/transformers`: **chưa cài; phiên bản chưa xác định**.
- `unpdf`: **chưa cài; phiên bản chưa xác định**. Chọn vì có PDF.js serverless cho Node, API trích chữ theo trang và tùy chọn tắt eval, không cần thêm multer/canvas/OCR. [Nguồn chính thức unpdf](https://github.com/unjs/unpdf).

`npm.cmd ls --workspace server @langchain/langgraph @langchain/core @anthropic-ai/sdk @huggingface/transformers unpdf --depth=0` trả `(empty)`, exit 1. `server/package.json` và `package-lock.json` nguyên trạng sau lệnh thất bại. Không tự ghi số phiên bản đoán, lockfile giả, ambient declaration hoặc shim để ép build/test đạt. Không cài thêm package khác.

Mô hình đã xác nhận tồn tại và có hướng dẫn Transformers.js trên [model card chính thức](https://huggingface.co/Xenova/multilingual-e5-small). **Chưa tải hoặc chạy mô hình**: dependency transformers chưa cài được nên chưa thể bắt đầu tải; chưa có bằng chứng download mô hình bị lỗi riêng. Không xác nhận kích thước tải hoặc chất lượng embedding tiếng Việt trên máy này.

## Test mới, không gọi dịch vụ mạng

Chỉ thêm các file sau; không thay đổi file test đã có:

- `server/src/tests/documents.test.ts`: API auth gate 401/403; quyền view/manage; upload PDF fixture thật/sai loại/giả mạo/hỏng/quá 20 MiB/không chữ; audit upload/delete; validate câu hỏi; thư viện rỗng; thiếu khóa; rate limit theo user; fail closed khi bật tracing/verbose. Dùng auth giả trong phạm vi file test, store/audit model giả để tránh DB; embedding giả; chặn global fetch.
- `server/src/tests/documentClaude.test.ts`: đồ thị LangGraph thật, Claude `messages.create` giả; prefix query, context/nguồn đúng, cấu hình request, không trả thinking, lỗi SDK có kiểu 429/5xx/4xx, lỗi kết nối/refusal/không đủ thông tin. Dùng SDK APIError thật khi dependency có sẵn; không giả LangGraph/SDK type. Stub biến tracing và fetch để không dùng mạng.
- `server/src/tests/documentRetrieval.test.ts`: validate/chunk/cosine/top6/excerpt.
- `server/src/tests/documentStore.test.ts`: kho JSON/PDF thật trong thư mục tạm, mutation đồng thời và xóa, không lộ vector qua list, ID không hợp lệ/404.
- `server/src/tests/documentStoreFailure.test.ts`: inject lỗi rename index để kiểm tra rollback upload/delete, tiếp tục mutation sau lỗi, không ghi đè JSON hỏng hoặc sai cấu trúc.

Các PDF/text trong test và selfcheck là fixture kiểm thử, không phải dữ liệu mẫu đưa vào giao diện.

## Bằng chứng kiểm tra thực tế

- `npm.cmd run build`: **không đạt**, exit 1. Server tsc báo TS2307 thiếu cả 4 module mới; kéo theo TS7006/TS18046/TS2347/TS7031 vì thiếu kiểu SDK/graph. Chưa thể xác nhận không còn lỗi TypeScript sau khi cài dependency thật.
- `npm.cmd test` tại root: **không chạy được test**, Vitest báo `spawn EPERM`, 16 lỗi khởi tạo worker; `Test Files no tests / Tests no tests`. Không khẳng định test cũ hay mới đạt.
- Lần test mới trước implementation (`documentStore.test.ts`, `documentRetrieval.test.ts`) cũng bị `spawn EPERM`, không quan sát được vòng đỏ/xanh bằng Vitest.
- Thử pool threads cho 2 test thuần: vẫn `spawn EPERM` ở Vite `optimizeSafeRealPathSync`, 2 suite failed trước khi chạy test. Không sửa config/test để né điều kiện kiểm tra.
- `npm.cmd run build --workspace client`: TypeScript qua, Vite dừng vì esbuild `spawn EPERM`; **chưa build client hoàn chỉnh**.
- `node node_modules/typescript/bin/tsc -b client`: **đạt**, exit 0.
- Transpile cú pháp bằng TypeScript API cho 5 file test tài liệu mới: **đạt**, exit 0; không phải chạy test hoặc kiểm tra kiểu dependency.
- `node --experimental-transform-types tasks/TASK-027-selfcheck.mjs`: **đạt**, exit 0 trên Node v24.21.0. Chạy code nguồn thật, không dùng dist/shim: kho cục bộ/ghi đồng thời/xóa/metadata, JSON hỏng/sai cấu trúc, validate PDF/tên/kích thước, chunk/trang, cosine/top6/excerpt, quyền mặc định. Global fetch bị chặn, không có query DB; tự dọn đúng thư mục tạm. Node có warning experimental transform types.
- Với JSON parse được nhưng sai cấu trúc: thêm assertion trước, selfcheck lỗi `Missing expected rejection`; thêm schema vào store rồi chạy lại đạt. Đây là kiểm tra đỏ/xanh thực tế cho nhánh này, không phải bằng chứng Vitest đã chạy.
- `git diff --check`: **đạt** (chỉ cảnh báo chuyển LF/CRLF của Git).
- `git diff --name-only -- server/src/tests server/prisma BossTele`: rỗng; các test mới là untracked, không có test cũ bị sửa. Kiểm tra tương tự `.env`, manifest/lockfile: rỗng.
- Impeccable detector đã chạy một lần. Phần lớn advisory là token/font của admin cũ khác DESIGN.md vốn mô tả trang đăng nhập; phần mới kế thừa admin theo spec. Không sửa thiết kế trang khác. **Chưa kiểm tra giao diện bằng browser** do chưa chạy được build/runtime trong sandbox này.

## Review nội bộ và giới hạn

Agent review nội bộ chỉ đọc đã phát hiện collision state/node LangGraph; đã sửa thành `reply` state / `answer` node. Review bổ sung nêu tracing có thể xuất dữ liệu ngoài Anthropic khi biến môi trường bật; đã thêm guard/test. Reviewer đọc delta cuối và không còn lỗi critical/important xác nhận được trong phạm vi code review; không xác nhận build/test hoặc runtime thật. Chưa có review độc lập của Claude và không gọi kết quả agent này là `verified`.

Kho JSON thiết kế cho **một tiến trình server**; không dùng chung giữa nhiều worker/máy. Ghi index nguyên tử không đồng nghĩa transaction filesystem bền vững qua mất điện; chưa thử crash/power loss. Các test rollback đã viết nhưng chưa chạy được bằng Vitest. Quyền MANAGER là mặc định trong code; vai trò/quyền tùy chỉnh đã lưu trong DB vẫn theo cơ chế permissionService hiện có, không tự chỉnh DB.

Chưa xác minh: parser PDF thật/scan/Vietnamese trong runtime, inference E5, request Claude thật và quyền truy cập model của tài khoản, audit DB thật, toàn bộ test cũ/mới và browser desktop/mobile.

## Claude tiếp tục

Tại PowerShell ở `D:\Website_3Q`, cài lại đúng 4 gói bằng lệnh npm ở trên (ngoài sandbox có mạng). Kiểm tra script cài đặt của dependency trước khi bật script cần thiết; không cài gói khác. Ghi phiên bản thật vào phần gói phía trên sau khi npm giải quyết thành công:

```powershell
npm.cmd ls --workspace server @langchain/langgraph @langchain/core @anthropic-ai/sdk @huggingface/transformers unpdf --depth=0
npm.cmd run build
npm.cmd test
```

Sau khi build đạt, có thể chạy tải mô hình/smoke embedding riêng (lệnh này có dùng mạng lần đầu; không phải automated test):

```powershell
node --input-type=module -e "const m = await import('./server/dist/services/documentEmbeddingService.js'); const v = await m.embed('query: kiểm tra'); console.log('Embedding dimension:', v.length);"
```

Bảo tự điền khóa Claude; không in khóa. Mở trang admin `#documents`, tải PDF tiếng Việt có chữ, hỏi 3 câu và đối chiếu nguồn/trang; kiểm tra câu ngoài tài liệu, quyền ADMIN/MANAGER/STAFF, lỗi thiếu khóa, PDF scan/quá giới hạn, xóa có xác nhận. Review code và chạy lại các test mới bằng dependency thật trước khi đánh dấu `verified`.
