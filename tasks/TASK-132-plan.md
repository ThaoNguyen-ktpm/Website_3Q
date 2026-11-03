Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-132 — Kế hoạch

1. Dùng route `#page=v2-<màn>` cho 7 báo cáo và 5 mục chưa kết nối; chuyển các route demo cũ sang màn tương ứng bằng replaceState. Giữ query chi tiết của V2 trong hash để F5 và Back/Forward đúng màn.
2. Dùng chung danh sách menu trong apps.ts cho drawer, sidebar và tabs; chỉ Admin thấy V2, giữ các trang quản lý theo quyền và nhãn THẬT.
3. Thêm iframe cùng nguồn, kiểm tra origin/source/allowlist khi nhận message; nhúng V2 tối thiểu, báo chiều cao nội dung và route. CSP chỉ cho frame cùng nguồn; không đổi auth/API/snapshot.
4. Bỏ phần render báo cáo demo cũ. Giữ demo-data.json cho Chính sách và simulated-api.ts cùng bản sửa TASK-130 theo yêu cầu trực tiếp.
5. Viết/cập nhật unit và browser test trước triển khai; Claude chạy test/build/browser theo phân công. Codex chỉ kiểm tra tĩnh/typecheck/cú pháp, ghi rõ giới hạn ảnh chụp Windows và chưa có red/green.
