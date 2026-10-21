# TASK-027 — Kế hoạch triển khai

Đặc tả: `tasks/TASK-027-spec.md`. Triển khai trực tiếp theo yêu cầu Bảo; không commit.

1. Thêm test mới cho upload/validate, phân quyền, kho JSON nguyên tử, cosine/top 6, Claude lỗi/refusal và rate limit. Claude/embedding được thay bằng hàm giả; không dùng mạng hoặc DB thật.
2. Backend theo route → controller → service → model: kho PDF/index JSON cục bộ; ingest theo trang, chunk 1000/overlap 150; embedding E5 cục bộ; LangGraph retrieve → answer. SDK và mô hình chỉ nạp khi dùng.
3. Gắn quyền và router; audit chỉ ghi hành động và ID tài liệu, không ghi nội dung. Upload chỉ sau xác thực/phân quyền, giới hạn 20 MB, tên file không dùng làm đường dẫn, ID UUID; ghi index qua file tạm và rename, tuần tự hóa thay đổi trong một tiến trình.
4. Thêm API client và trang Tài liệu trong admin hiện có, kế thừa CSS tối/tím, quản lý tải lên/xóa theo quyền; hỏi độc lập, trạng thái lỗi và thử lại, hiển thị nguồn bằng text.
5. Cập nhật `.env.example`, `.gitignore`, AGENTS và PRODUCT. Chạy build/test toàn repo, kiểm tra diff không đổi test cũ/schema/DB/.env; ghi result và giới hạn môi trường.

## Các trường hợp cần kiểm tra

- Tên file lỗi mã hóa/path traversal; PDF giả, PDF scan, vượt kích thước.
- Upload/xóa đồng thời và ghi index thất bại không làm mất bản index cũ.
- Không có tài liệu không gọi Claude/embedding; thiếu khóa trả 503.
- Nguồn giữ đúng trang, excerpt <= 200; cosine không chia 0.
- Anthropic 429/5xx/khác/refusal, không lộ lỗi thô hoặc khóa; giới hạn theo user.

## Môi trường

Lệnh npm cài đúng 4 gói (`@langchain/langgraph`, `@anthropic-ai/sdk`, `@huggingface/transformers`, `unpdf`) đã thất bại ENOTCACHED (sandbox only-if-cached). Chưa có phiên bản cài thực tế hoặc lockfile mới. Không tạo shim thư viện để giả build thành công. Claude cần cài lại và kiểm tra tương thích SDK thực tế.
