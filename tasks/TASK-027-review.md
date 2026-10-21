# TASK-027 — Review: hỏi đáp tài liệu PDF (LangGraph + Claude)

- Người review: Claude. Trạng thái: verified (code, build/test, đọc PDF và embedding thật, giao diện); hỏi đáp qua Claude thật: blocked — chưa có `ANTHROPIC_API_KEY` trong `server/.env`.

## Claude bổ sung
- Cài 4 gói đã duyệt (sandbox Codex chặn mạng), `--save-exact --ignore-scripts`, workspace `server`: `@langchain/langgraph` 1.5.1 (kéo `@langchain/core` 1.2.18), `@anthropic-ai/sdk` 0.135.0, `@huggingface/transformers` 4.3.1, `unpdf` 1.9.0. Không cài gói khác. Bản lockfile cũ lưu ở scratchpad.
- Sửa `documentIngestService.extractPages`: `PDFDocumentProxy.destroy()` không có trong PDF.js của unpdf 1.9 (gây 500 khi tải lên, 2 test đỏ, 2 lỗi TS) → dọn qua `document.loadingTask.destroy()`; bỏ tùy chọn `isEvalSupported`/`useSystemFonts` không còn trong kiểu.
- Sửa `documentQaGraph`: `max_tokens` 2048 → 16000 (Opus 5.5 luôn bật thinking, token thinking tính vào `max_tokens`, 2048 dễ cắt câu trả lời).

## Bằng chứng
- `npm run build`: đạt. `npm test`: 17 file, 298/298 đạt (gồm 5 file test mới; test cũ không bị sửa). `TASK-027-selfcheck.mjs`: đạt.
- Đọc PDF thật bằng unpdf: trích đúng chữ theo trang.
- Embedding thật `Xenova/multilingual-e5-small` (tải 130 MB vào `server/data/models/`, đã nằm trong `.gitignore`): 384 chiều, câu hỏi tiếng Việt khớp đoạn liên quan 0.937 > đoạn không liên quan 0.812; ~7 s lần đầu (gồm nạp mô hình).
- Giao diện (phiên giả lập): mục "Tài liệu", khung tải lên, bảng tài liệu, khung hỏi đáp; thiếu khóa → hiện "Chưa cấu hình khóa Claude." + "Thử lại".

## Còn lại
- Bảo điền `ANTHROPIC_API_KEY` vào `server/.env`, khởi động lại server, rồi thử tải PDF thật và hỏi 3 câu (chưa kiểm chứng câu trả lời và nguồn trích qua Claude thật).
- Đề xuất (chưa làm): bật refusal fallback phía server cho `claude-opus-5-5` (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) — cần đổi sang `client.beta.messages.create` và cập nhật test mock.
- Kho JSON chỉ cho một tiến trình server (Codex đã ghi).

## Kết luận
verified cho phần chạy được trên máy; hỏi đáp Claude thật: blocked chờ khóa.

## Gỡ rồi khôi phục (Bảo, 2026-10-17)
- Bảo yêu cầu gỡ toàn bộ TASK-027; Claude sao lưu rồi gỡ (build đạt, 264/264). Sau khi xem các lựa chọn khác (ODS, plugin EzyPlatform — chỉ chạy trên site EzyPlatform/Java), Bảo yêu cầu khôi phục.
- Khôi phục từ bản sao lưu: xác nhận 11 file dùng chung không đổi kể từ lúc gỡ, chép lại toàn bộ; cài lại 4 gói theo lockfile đã sao lưu (cùng phiên bản). Mô hình embedding (130 MB) sẽ tự tải lại ở lần tải PDF đầu tiên.
- Bằng chứng: build đạt; 17 file, 298/298 test đạt; `/api/documents` chưa đăng nhập → 401 (route đã gắn lại).

## Nối Ollama (Bảo, 2026-10-17)
- Bảo cài Ollama 0.40.5; Claude đặt `OLLAMA_MODELS=D:\ollama\models` (User) và chuyển mô hình `qwen3:8b` (Q4_K_M, 5,2 GB) từ C sang D. Chạy 100% GPU RTX 4060, ~36 token/giây khi đã nạp; câu đầu sau khi nghỉ chậm (~90 s).
- `config/env.ts`: thêm `LLM_BASE_URL` (URL http/https, tùy chọn) và `LLM_MODEL` (mặc định `qwen3:8b`). `documentQaGraph.ts`: thêm `answerWithOllama` (API gốc `/api/chat`, `think:false`, `num_ctx: 8192`, timeout 180 s, bỏ khối `<think>`, lỗi mạng/5xx/429 → 503, lỗi khác → 502); `askDocuments` chọn Claude khi có `ANTHROPIC_API_KEY`, ngược lại Ollama; không có cả hai vẫn 503 "Chưa cấu hình khóa Claude." như cũ. `server/.env.example` và `server/.env` thêm hai biến (không phải bí mật).
- Giới hạn: dùng API gốc của Ollama; ODS (llama-server) cần đổi sang `/v1/chat/completions` — đã ghi `shortcut:` trong code.
- Test mới `documentOllama.test.ts` (7 test, fetch giả). Build đạt; 18 file, 306/306 test đạt; test cũ không sửa.
- Chạy thật (embedding + Ollama, tài liệu mẫu chỉ trong script, không ghi vào kho): câu có trong tài liệu → "60% lợi nhuận … trang 1" (6,8 s); câu ngoài tài liệu → nói rõ tài liệu không có (0,9 s). Server API khởi động lại, `/api/health` 200.
