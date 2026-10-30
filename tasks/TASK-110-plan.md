# TASK-110 — Kế hoạch triển khai

- Mục tiêu: chuyển Tài liệu sang giao diện 8787 trước khi bỏ client cũ.
- Thực hiện theo thứ tự A → B, giữ stack, API và dữ liệu hiện có; không commit, không thay tiến trình server.

## A — Tài liệu
- [x] Kiểm thử quyền documents.view trên allowedPage; kiểm thử hợp đồng fetch của API tài liệu bằng runner Playwright đã cài (không trình duyệt).
- [x] Chuyển API nguyên trạng, trang React/TS giữ PDF 20 MB, hủy request khi unmount, lỗi/thử lại, xác nhận xóa, câu trả lời và nguồn.
- [x] Thêm MANAGE dưới Nhật ký; workspace chỉ tải sau đăng nhập, trang tài liệu lazy; canManage dùng documents.manage.

## B — Chỉ giữ frontend
- [x] Sao lưu hai file client có thay đổi trước phiên; liệt kê 67 file. git rm bị chặn index.lock; đã archive toàn bộ file, còn vỏ thư mục rỗng (chi tiết result).
- [x] Bỏ workspace client; build/test gọi frontend qua --prefix để giữ lockfile độc lập và dependency sẵn có.
- [x] Dev chỉ chạy server, frontend, bot; mặc định origin 8787, giữ LAN và EXTRA_ORIGINS.
- [x] Chuyển CSP của client sang frontend, sửa deploy, mac-forward, test origin, tài liệu hiện hành và lockfile gốc.
- [x] Build, test web, test BossTele; ghi lỗi sandbox và giới hạn thật vào result ready_for_review. Không chạy npm run dev để tránh đụng server đang chạy.
