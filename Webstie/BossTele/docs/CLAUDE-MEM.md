# Claude-Mem — chuẩn bị cài cho BossTele

## Trạng thái
Đã tải mã nguồn, chưa đăng ký hoặc bật plugin, chưa khởi chạy worker.

- Nguồn: https://github.com/thedotmack/claude-mem.git
- Bản tải: v13.39.0, commit `fef3402e674bebbf72a23aeb735e91c92cd34afd`.
- Thư mục: `vendor/claude-mem`, checkout cố định commit.
- Giấy phép Apache-2.0 và NOTICE có trong mã nguồn.
- `AGENTS.md`, `CLAUDE.md` và Ponytail của BossTele vẫn giữ nguyên.

## Cấu hình đề xuất, chưa áp dụng
`docs/claude-mem-settings.proposed.json`: cấu hình worker/bộ nhớ.
`docs/claude-mem-env.proposed.json`: biến môi trường chỉ dành cho các tiến trình BossTele.

- Lưu SQLite trong `D:\Website_3Q\BossTele\.claude-mem`; viewer chỉ nghe localhost, cổng 37777.
- Claude Code bật theo phạm vi project. Tích hợp Codex cần kiểm tra phạm vi đăng ký native plugin, không tự bật ghi nhớ cho các dự án khác.
- Hook lưu hoạt động tool của các phiên được bật. Tóm tắt dùng provider Claude và tiêu hao gói/quota Claude hiện có.
- Lưu trữ cục bộ không có nghĩa xử lý AI offline: dữ liệu đưa vào bước tóm tắt được gửi tới Anthropic.
- Không đăng ký CMEM; để trống URL/token cloud-sync, tắt telemetry qua env.
- Chỉ dùng SQLite trước; Chroma/vector search tắt, chưa cần uv hoặc tải mô hình embedding.
- Không tự sửa CLAUDE.md, không quét lịch sử transcript hoặc ingest phiên subagent.
- Cho phép truy hồi giữa các nguồn agent trong cùng dự án khi hai tích hợp đã hoạt động; không tuyên bố đã dùng chung bộ nhớ ở hiện trạng này.

## Hai điểm đang chặn
1. Auto-review từ chối lệnh đăng ký plugin vì nó bật hook/service có thể thu thập và lưu session/code; yêu cầu cài ban đầu chưa được reviewer coi là cho phép các tác động dữ liệu này. Cần người dùng cho phép rõ phạm vi trên trước khi tiếp tục bật plugin.
2. `claude plugin validate` trên plugin và marketplace hiện báo tên `claude-mem` bị CLI xem là tên dành riêng. Đây là vấn đề tương thích được kiểm chứng trên CLI hiện có. Chưa thực hiện đổi tên plugin, hạ phiên bản CLI hay ghi trực tiếp registry để né kiểm tra. Khi được phép tiếp tục, cần tìm phương thức cài được upstream/host hỗ trợ.

## Việc còn lại sau khi được phép
Giải quyết tương thích bằng phương thức được hỗ trợ; đăng ký plugin có phạm vi phù hợp; cài runtime/launcher/dependency cần thiết; áp dụng cấu hình dự án; khởi chạy worker và kiểm tra health, lưu một quan sát demo, tìm lại từ phiên mới. Không ghi kết luận hoạt động nếu chỉ có mã nguồn hay manifest.
