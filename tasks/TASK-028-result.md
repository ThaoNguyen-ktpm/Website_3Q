# TASK-028 — Kết quả triển khai trợ lý Website_3Q

- Dự án: web. Người triển khai: Codex.
- Trạng thái: **ready_for_review**. Chưa được Claude kiểm tra; không ghi verified.
- Hành động gần nhất: triển khai API, graph, công cụ, widget; sửa phát hiện review về danh sách nhân viên bị cắt; chạy kiểm tra offline.
- Bước tiếp theo: Claude chạy lại full build/test ngoài sandbox, thử mô hình thật và xem UI desktop/375px theo đặc tả.

## Phạm vi đã thực hiện

- Giữ các giả định 1–5 của spec: admin đã đăng nhập, chỉ đọc, quyền do server kiểm tra, không truy cập số liệu mẫu trong trình duyệt, lịch sử ở state App.
- Đọc AGENTS.md, tasks/README.md, TASK-028-spec.md và TASK-027-review.md; dùng `codegraph_explore` trước khi sửa và tra luồng/phạm vi ảnh hưởng. Kế hoạch: `tasks/TASK-028-plan.md`.
- `POST /api/assistant/chat`: requireAuth, kiểm tra zod (1–10 tin, 1–2000 ký tự, tin cuối user), lỗi tiếng Việt, no-store, limiter riêng 20 lần/phút theo user.id. Không lưu/log hội thoại.
- LangGraph classify → agent: chỉ kết quả ON mới đi tiếp; kết quả khác trả đúng câu từ chối cố định, không gọi công cụ hoặc bước trả lời. Classifier nhận tối đa hai tin trước câu hỏi cuối.
- Agent tối đa bốn vòng, tối đa năm tool calls/vòng để giới hạn chi phí; batch quá lớn dừng an toàn. Kết quả công cụ tối đa 4.000 ký tự, JSON hợp lệ và có dấu hiệu cắt ngắn. Nguồn lấy từ công cụ, loại trùng.
- Năm công cụ có JSON schema và zod; kiểm quyền trước đọc nguồn/embedding. Chỉ đưa trường cần thiết vào mô hình; không chuyển raw sản phẩm, googleSub, quyền nhân viên hoặc snapshot/IP nhật ký. Giá vốn chỉ được đưa vào khi có products.cost, kể cả khi nguồn trả dư trường. Nhân viên trả total/truncated để không nhầm danh sách cắt là toàn bộ.
- Hướng dẫn menu/quyền/vai trò dựa trên App, controller và config/permissions hiện có; ghi rõ các trang dữ liệu mẫu và giới hạn của trợ lý. Tìm kiếm dùng nhãn Hot trend/tồn kho theo code thực tế.
- Claude được ưu tiên khi có khóa: SDK hiện có, claude-opus-5-5, effort low, tool_choice auto, strict tools. Còn lại gọi Ollama /api/chat với tools, think false, num_ctx 8192. Thiếu cấu hình, tracing, lỗi kết nối/provider có thông báo an toàn.
- Tách transport Claude/Ollama và guard tracing dùng chung sang modelTransport.ts. Hỏi đáp tài liệu giữ prompt, payload, chọn provider, nguồn, thông báo thiếu cấu hình, fallback rỗng/refusal và ánh xạ lỗi hiện có. Không sửa route/controller tài liệu.
- Widget ở App giữ mở/đóng và lịch sử khi đổi trang; chỉ gửi 10 tin gần nhất và giới hạn nội dung lịch sử gửi lại theo API. Có gợi ý, nguồn dạng chip, giờ gửi, loading, lỗi/thử lại, hủy request khi đóng/chuyển trang/unmount, Enter/Shift+Enter, focus khi mở, Escape, aria-live. Chỉ render text thuần. CSS tối/tím, nút 56px, panel 380×520 giới hạn theo viewport, mobile gần toàn màn hình, z-index 25 dưới drawer 60, chừa khoảng cuối trang cho nút nổi.

## File của TASK-028

- Server mới: `server/src/services/modelTransport.ts`; `server/src/services/assistant/{graph.ts,model.ts,tools.ts,websiteGuide.md}`; `server/src/controllers/assistantController.ts`; `server/src/routes/assistantRoutes.ts`.
- Server sửa: `server/src/app.ts` (gắn assistant route); `server/src/services/documentQaGraph.ts` (dùng transport chung).
- Client mới: `client/src/api/assistant.ts`; `client/src/admin/components/AssistantWidget.jsx`.
- Client sửa: `client/src/admin/views/App.jsx` (state/render widget); `client/src/admin/styles.css` (CSS scoped cho widget).
- Test mới: `server/src/tests/assistantApi.test.ts`, `assistantGraph.test.ts`, `assistantModel.test.ts`, `assistantTools.test.ts`.
- Selfcheck: `tasks/TASK-028-selfcheck.mjs`, `tasks/TASK-028-ui-selfcheck.mjs`.

Không thêm/xóa/đổi vai trò thư mục cấp repo trong Bản đồ repo; thư mục assistant nằm dưới services hiện có.

## Bằng chứng kiểm tra

1. `npm.cmd run build --workspace server`: **đạt**, TypeScript server biên dịch thành công.
2. `npm.cmd exec --workspace client -- tsc -b`: **đạt**. JSX widget còn được transpile và render bằng React DOM server trong selfcheck UI.
3. `node --experimental-transform-types tasks/TASK-028-selfcheck.mjs`: **50 kiểm tra offline đạt**. Chạy graph, công cụ, provider adapters và hỏi đáp tài liệu thật trong code; thay các boundary bằng hàm trong bộ nhớ. Bao gồm kiểm quyền trước truy cập, ẩn giá vốn, truy xuất sáu đoạn, guide, validation, OFF fail-closed, bốn vòng, tracing, thiếu cấu hình, lỗi HTTP/network, Claude/Ollama và tương thích một số nhánh của documents/ask. Không gọi mạng, DB hoặc đọc .env. Node có cảnh báo tính năng transform-types thử nghiệm.
4. `node --experimental-transform-types tasks/TASK-028-ui-selfcheck.mjs`: **đạt**. Kiểm JSX/SSR widget thật, lời chào/gợi ý, nguồn, escape HTML, giao diện retry; client gửi 10 tin cuối, credentials/no-store/AbortSignal, xử lý lỗi HTTP và dữ liệu hỏng. **Đây không phải kiểm thử tương tác hoặc layout trong trình duyệt.**
5. Đối chiếu SHA-256 với đầu phiên: **18/18 file test có sẵn giữ nguyên**. Không sửa, nới hoặc xóa test cũ. Các test mới dùng boundary mock; API tests dùng supertest tại chỗ, không gọi upstream thật.
6. `git diff --check`: **đạt**; Git có cảnh báo chuyển LF/CRLF ở các file của working tree.
7. `npm.cmd run build`: **chưa đạt do môi trường**, server và client TypeScript chạy được; Vite không tải được config vì esbuild `spawn EPERM`.
8. `npm.cmd test`: **không thực thi được test**, Vitest báo 22 worker errors `spawn EPERM` và timeout khi kết thúc worker; không có kết quả pass/fail cho assertions. Thử nhóm test mới bằng `--pool=threads` cũng gặp `spawn EPERM` trong Vite Windows realpath. Test đã viết trước code nhưng không thể xác minh bước đỏ/xanh bằng Vitest trong sandbox này. Không dùng selfcheck để tuyên bố toàn bộ test cũ/mới đạt.
9. Đã chạy Impeccable detector một lần cho widget/CSS; detector có cảnh báo advisory về literal token/type/radius so với DESIGN.md của trang đăng nhập và các đoạn admin có sẵn. Giữ tông admin tối/tím theo spec, không đổi thiết kế trang đăng nhập hoặc CSS ngoài phần widget.

## Review và giới hạn

- Reviewer subagent đọc độc lập thay đổi phát hiện P2: danh sách nhân viên bị giới hạn 10 người mà không báo còn dữ liệu. Đã sửa bằng total/truncated, thêm test và selfcheck >10 người/nội dung dài. Reviewer đọc lại và tự chạy selfcheck **50/50 đạt**, không còn finding cụ thể trong phần sửa đó. Đây không phải review Claude và không thay thế các bước nghiệm thu còn lại.
- Chưa gọi Ollama/Claude, KiotViet, PDF thật, nhân viên/nhật ký thật trong lần triển khai này. Chưa đo độ trễ, chất lượng classifier/tool use hoặc xác minh sáu câu nghiệm thu bằng mô hình thật. Cần kiểm tra cả hội thoại dài 10 tin khi dùng Claude.
- Công cụ trình duyệt từ chối quyền xem `http://localhost:5173`; không thử truy cập bằng cách khác. Chưa xem desktop/375px, kiểm focus/scroll/đè phân trang/drawer và tương tác hủy/retry trên trình duyệt.
- Guide được đọc từ `server/src/services/assistant/websiteGuide.md` khi chạy src hoặc dist trong checkout. Nếu đóng gói chỉ thư mục dist, cần mang theo tài nguyên guide ở đường dẫn này.
- Limiter dùng bộ nhớ của một tiến trình, theo pattern đang có. Classifier dựa trên mô hình theo spec; kiểm thử giả lập không chứng minh mô hình thật luôn phân loại đúng.
- Repo đã có thay đổi TASK-027 và các file khác trước phiên; đã bảo toàn. TASK-028 không cài gói, không đổi manifest/lockfile, DB/schema/.env, không sửa BossTele, không commit.

## Lệnh Claude cần chạy lại tại D:\Website_3Q

```powershell
npm.cmd run build
npm.cmd test
node --experimental-transform-types tasks/TASK-028-selfcheck.mjs
node --experimental-transform-types tasks/TASK-028-ui-selfcheck.mjs
```

Sau đó thử sáu câu nghiệm thu với Ollama qwen3:8b, đo thời gian; kiểm giao diện desktop và 375px, chuyển trang giữ lịch sử, đóng khi đang chờ, mở lại/tiếp tục, retry không nhân đôi câu hỏi và đăng xuất. Chỉ ghi verified sau khi Claude có bằng chứng kiểm tra độc lập đầy đủ.
