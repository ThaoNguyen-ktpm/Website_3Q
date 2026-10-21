# TASK-027 — Hỏi đáp tài liệu PDF nội bộ (LangGraph + Claude)

- Dự án: web (`server/`, `client/`). Người phụ trách: Claude (đặc tả, review), Codex (code).
- Trạng thái: ready — Bảo duyệt 2026-10-17: cài 4 gói mới (mục "Gói cài mới") và gửi nội dung đoạn tài liệu tới Anthropic; giả định 1–5 giữ như đề xuất.
- Nguồn yêu cầu: Bảo 2026-10-17 muốn dựng lại chatbot PDF của repo `mayooear/ai-pdf-chatbot-langchain` (đã archived, thư viện cũ, Next 14.2.16 dính CVE-2025-29927) theo LangChain/LangGraph hiện tại. Bảo chọn: dùng để hỏi đáp tài liệu nội bộ BaoQ, gắn vào trang admin; mô hình Claude; lưu dữ liệu trên máy, không dùng dịch vụ vector.
- Áp dụng `AGENTS.md` mục "Quy tắc code". Không sửa/nới test cũ, chỉ thêm test. Không commit. Không sửa `.env` (chỉ `.env.example`).

## Giả định (Claude đề xuất)
1. Không chép repo cũ; chỉ giữ ý tưởng hai luồng: nạp tài liệu và hỏi đáp. Không dùng Supabase, Next.js, LangGraph Cloud.
2. Gắn vào server Express + client React hiện có, không dựng ứng dụng riêng.
3. LangGraph.js điều phối luồng hỏi đáp (`retrieve` → `answer`); node `answer` gọi Claude qua SDK chính thức `@anthropic-ai/sdk`, mô hình `claude-opus-5-5`, `output_config.effort: "low"`, không gửi `thinking` (Opus 5.5 luôn bật thinking thích ứng). Khóa đọc từ `ANTHROPIC_API_KEY` trong `server/.env` (Bảo tự điền).
4. Claude không có API embedding → embedding chạy trên máy bằng `@huggingface/transformers` với mô hình đa ngôn ngữ (đề xuất `Xenova/multilingual-e5-small`; Codex xác minh tên/khả dụng). Lần chạy đầu tải mô hình ~100–150 MB về cache cục bộ.
5. Quyền mới: `documents.view` (hỏi đáp) và `documents.manage` (tải lên/xóa). ADMIN có cả hai; MANAGER có `documents.view`; STAFF không có mặc định.

## Gói cài mới (cần Bảo duyệt — ngoại lệ quy tắc "không cài gói")
- `@langchain/langgraph` (+ peer `@langchain/core`): đồ thị hỏi đáp.
- `@anthropic-ai/sdk`: gọi Claude.
- `@huggingface/transformers`: embedding cục bộ.
- Một thư viện đọc PDF còn bảo trì (ưu tiên `pdfjs-dist` hoặc `unpdf`; **không** dùng `pdf-parse` 1.1.1). Codex chọn, ghi lý do và phiên bản trong result.
- Không cài multer: upload gửi thân `application/pdf` thô qua `express.raw`.

## Vùng code
- Điểm vào: `server/src/app.ts` (gắn router), `server/src/config/permissions.ts`, `server/src/config/env.ts` (thêm `ANTHROPIC_API_KEY` tùy chọn), `client/src/admin/views/App.jsx` (`nav`, quyền theo trang, render trang), `client/src/admin/styles.css`.
- Thêm mới (theo lớp route → controller → service → model sẵn có): `routes/documentRoutes.ts`, `controllers/documentController.ts`, `services/documentIngestService.ts` (đọc PDF, cắt đoạn, embedding), `services/documentQaGraph.ts` (LangGraph), `models/documentStore.ts` (đọc/ghi chỉ mục JSON), `client/src/api/documents.ts`, test `server/src/tests/documents.test.ts`.
- Dữ liệu: `server/data/documents/` (PDF gốc + `index.json`); thêm `server/data/` vào `.gitignore`.
- Ảnh hưởng: `permissions.ts` → danh mục quyền trang Nhân viên tự hiện quyền mới; test quyền hiện có phải vẫn đạt.
- Không đụng: trang Tìm kiếm/KiotViet, đăng nhập, Prisma schema, BossTele.

## Yêu cầu

### 1. Nạp tài liệu — `POST /api/documents` (`requireAuth` + `documents.manage`)
- Thân `application/pdf`, tên file qua header `X-File-Name` (encodeURIComponent). Giới hạn 20 MB; kiểm tra chữ ký `%PDF-`; sai → 400 tiếng Việt.
- Trích văn bản theo trang → cắt đoạn ~1.000 ký tự, chồng 150, giữ số trang → embedding (tiền tố `passage: ` nếu dùng e5) → lưu vào `index.json` (`id`, `name`, `pages`, `uploadedAt`, `uploadedBy`, `chunks[{text,page,vector}]`). Ghi file an toàn (ghi tạm rồi đổi tên).
- PDF không có chữ (ảnh scan) → 422 "Tài liệu không có văn bản để đọc (có thể là ảnh scan)." Không OCR.
- Ghi nhật ký thao tác qua `auditService` sẵn có (`document.upload`, `document.delete`).
- `GET /api/documents` (`documents.view`): danh sách tài liệu (không trả vector). `DELETE /api/documents/:id` (`documents.manage`).

### 2. Hỏi đáp — `POST /api/documents/ask` (`documents.view`)
- Thân `{ question: string 1–1000 }`. Đồ thị LangGraph: `retrieve` (embedding câu hỏi với tiền tố `query: `, cosine, lấy 6 đoạn tốt nhất) → `answer` (Claude).
- Prompt hệ thống cố định (cache được): trả lời tiếng Việt, chỉ dựa trên đoạn được cung cấp, không đủ thông tin thì nói rõ là tài liệu không có. Mỗi đoạn gửi kèm tên tài liệu + số trang.
- Response `{ answer, sources: [{ documentId, name, page, excerpt }] }` (`excerpt` ≤ 200 ký tự). Không có tài liệu nào → trả lời ngay "Chưa có tài liệu nào được tải lên." không gọi Claude.
- Thiếu `ANTHROPIC_API_KEY` → 503 "Chưa cấu hình khóa Claude." Lỗi Anthropic xử lý bằng lớp lỗi có kiểu của SDK (429/5xx → 503 thông báo thử lại; khác → 502), không lộ khóa hay thông báo gốc. `stop_reason === "refusal"` → câu trả lời từ chối lịch sự. Rate limit riêng cho `/ask` (ví dụ 20 lần/phút/người) dùng `express-rate-limit` sẵn có.
- Không lưu lịch sử hội thoại (mỗi câu hỏi độc lập).

### 3. Client — mục "Tài liệu"
- `nav`: `['documents','file','Tài liệu']` (dùng icon có sẵn phù hợp nếu không có `file`), quyền `documents.view`.
- Khung tải lên (chỉ hiện với `documents.manage`): chọn file PDF, nút "Tải lên", trạng thái đang xử lý; bảng tài liệu: tên, số trang, ngày tải, người tải, nút Xóa (xác nhận trước khi xóa).
- Khung hỏi đáp: ô nhập câu hỏi + nút "Hỏi"; hiện câu trả lời (text thuần, giữ xuống dòng) và danh sách nguồn "Tên tài liệu · trang N" kèm trích đoạn. Trạng thái đang trả lời, lỗi + thử lại.
- CSS trong `@scope (.admin-page)` dùng token sẵn có, tông tối + tím hiện tại.

### 4. Tài liệu
- `server/.env.example`: thêm `ANTHROPIC_API_KEY=` có chú thích.
- `AGENTS.md`: ngoại lệ thứ ba "gọi Anthropic API cho hỏi đáp tài liệu (TASK-027); nội dung đoạn tài liệu được gửi tới Anthropic".
- `PRODUCT.md` hoặc README: một đoạn ngắn cách dùng.

## Tiêu chí nghiệm thu
- Tải lên một PDF tiếng Việt có chữ → xuất hiện trong bảng với số trang đúng; PDF giả mạo/quá 20 MB/ảnh scan → báo lỗi đúng.
- Hỏi một câu có trong tài liệu → câu trả lời đúng ý, có nguồn đúng tên + trang. Hỏi câu không có trong tài liệu → nói rõ tài liệu không có thông tin.
- Người không có quyền: không thấy mục, API 403; chưa đăng nhập 401.
- Không có `ANTHROPIC_API_KEY` → 503 đúng thông báo; trang không vỡ.
- Test cũ đạt nguyên trạng; test mới (Claude và embedding được thay bằng hàm giả, không gọi mạng): upload hợp lệ/sai, quyền, ask khi không có tài liệu, chọn đoạn theo cosine, xử lý lỗi Anthropic, refusal.

## Lệnh kiểm tra
- `npm run build` và `npm test` tại `D:\Website_3Q`. Sandbox chặn tiến trình con → ghi rõ, Claude chạy lại.
- Claude review: tải một PDF thật (chỉ khi Bảo đã điền khóa), hỏi 3 câu, kiểm tra nguồn trích.

## Điểm còn cần quyết định
- Giả định 1–5.
