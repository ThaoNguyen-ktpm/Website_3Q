# TASK-133 — Kế hoạch triển khai

Đặc tả: `tasks/TASK-133-spec.md`. Giữ stack hiện có, không commit/chuyển nhánh, không sửa `shared/`, BossTele hay `server/src/services`.

- [x] Cập nhật hai assertion trong `Webstie/frontend/task041.spec.ts` sang `toHaveCount(0)`, thử chạy Playwright với `task041.config.ts` trước khi sửa HTML.
- [x] Trong `Webstie/server/src/v2/mockup/baoq-mockup-v2.html`, bỏ điều khiển/ghi chú ở home, band chung và Chính sách; bỏ handler click/change/Escape liên quan, CSS và ba khóa dịch không còn dùng. Bỏ helper bandControls nếu rỗng. Giữ mặc định CEO, grants, kỳ dữ liệu, nhãn demo trong bảng và bridge TASK-132.
- [x] Cập nhật `Webstie/server/src/v2/README.md` để ghi rõ khác biệt TASK-133 so với nguồn.
- [x] Chạy build, test chung, Playwright, kiểm tra cú pháp inline/UTF-8/diff và bản dist nếu build đã chép; ghi bằng chứng thực tế và giới hạn trong result tiếng Việt, trạng thái `ready_for_review`.

Trọng tâm rà soát: không sót ghi chú ở Chính sách hoặc Escape handler; không làm mất CSS kỳ dữ liệu; giữ cấu trúc HTML cân bằng; giữ CEO/grants và nhãn dữ liệu mẫu; không đè thay đổi có sẵn của TASK-132/TASK-131.
