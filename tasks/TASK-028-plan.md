# TASK-028 — Kế hoạch triển khai

- Dự án: web. Codex triển khai theo spec đã được Bảo giao trực tiếp; không commit.
- Giữ các giả định 1–5 của spec. Dùng stack, quyền và nguồn dữ liệu hiện có.

1. Thêm test offline cho guard ON/OFF, vòng công cụ tối đa 4, kiểm quyền trước truy cập dữ liệu, giới hạn/validation API và lỗi provider. Chạy test đỏ trước triển khai.
2. Tách transport Claude/Ollama dùng chung từ documentQaGraph, giữ nguyên payload và fallback của hỏi đáp tài liệu. Thêm assistant model adapter, tools (allowlist trường dữ liệu), websiteGuide dựa trên menu/quyền thật và graph classify → agent.
3. Gắn controller/router có requireAuth, no-store, limiter 20/phút/user; không đổi API hiện có, DB, schema hoặc môi trường.
4. Thêm API client và widget trong App: state ở App, lịch sử 10 tin, hủy request, retry, focus/Escape, text thuần, giao diện tối/tím responsive dưới drawer. Thêm selfcheck UI không gọi dịch vụ thật.
5. Chạy build và toàn bộ test nguyên trạng; đối chiếu hash test cũ, kiểm tra diff và ghi TASK-028-result.md với bằng chứng/giới hạn. Bàn giao ready_for_review cho Claude; chưa gọi verified.

Trọng tâm kiểm tra: OFF/đầu ra phân loại sai không truy cập tools; thiếu quyền không đọc dữ liệu/giá vốn; tool args sai và model output hỏng; tracing chặn trước model; đóng/chuyển trang hủy request và retry không nhân đôi câu hỏi; documents/ask không đổi.
