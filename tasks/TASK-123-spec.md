Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-123: Trang Sale AI báo "Cannot read properties of null (reading 'status')" sau khi tải lại

- Dự án: web (Sale AI)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. **Gấp, sửa nhỏ.**

## Lỗi thật (02/11/2026 ~14:20)

Bảo bấm F5 trang Sale AI. Trang hiện "Cannot read properties of null (reading 'status')" ở ô tiến độ và ô thông báo.

Claude dựng lại được trên bản chép dữ liệu (cổng 4598) với code hiện tại. Nguyên nhân nằm ở vòng hỏi `/api/status` mỗi 3 giây trong `server/src/sale-ai/public/app.js`:

```js
if(dataset==='real'&&status.job?.id===observedJob&&status.job.status!=='running'&&finishedJob!==observedJob){
```

Sau khi máy chủ khởi động lại thì chưa có lượt nền nào: `status.job` là `null`, `observedJob` là `undefined`. `undefined===undefined` cho ra true, nên `status.job.status` đọc `null` và ném lỗi.

## Yêu cầu

1. Chỉ vào nhánh này khi thật sự đang theo dõi một lượt: `observedJob` có giá trị và `status.job` không rỗng. Sửa tối thiểu, ví dụ `observedJob&&status.job?.id===observedJob&&...`.
2. Rà các chỗ cùng kiểu trong `public/app.js` và `public/live-ui.js` (so sánh `?.id===` với biến có thể `undefined`, đọc `.status` của `job` có thể `null`). Sửa nếu có cùng lỗi.
3. Thêm test trong `test/background-ui.test.js`: `/api/status` trả `job:null` khi trang chưa theo dõi lượt nào, thì không có thông báo lỗi và bảng vẫn hiện.

## Lệnh kiểm tra (Claude chạy)

`npm run build`, `npm test`, `node --test` lõi Sale AI, E2E 5 lần, BossTele `npm test`.

## Cách làm

- Codex chạy `-a never`. Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-123-result.md`.
