Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-119: Sale AI chỉ cập nhật giá Kiot; không ghi mô tả Kiot, không đụng Sapo

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`.

## Yêu cầu của Bảo (02/11/2026)

> "sửa lại quy trình mới là chỉ cập nhật giá trên kiot và ko cập nhật mô tả kiot ko cập nhật giá sapo - nhưng trên bảng Sale-AI vẫn để phần mô tả cho người dùng biết"

## Hiện trạng

- Lượt cập nhật hiện ghi **hai bên**: Kiot `basePrice` + `description` (ghi chú BAOQ do `liveNote` tạo), và Sapo giá + mô tả (`sapoNote`).
- Các chỗ ghi:
  - `lib/joint-update.js`: worker gửi `sendUpdate(fresh,{basePrice,description:desired})`, xác minh `currentPrice` và `notes`.
  - `lib/batch-joint.js` `kiotLot`: `updateMany(... {basePrice, description:i.desiredNote})`, xác minh `currentPrice` và `notes`.
  - `lib/batch-update.js`: kiểm tra tương tự.
- Đã có công tắc `createSaleAi({sapoWrite:false})`, đặt `live.sapoWrite` và `live.requireJoint`. Khi tắt, `prepare` chỉ lấy `platforms:['kiot']` và trang đổi chữ thành "Kiot". `runtime.ts:46` hiện chưa truyền công tắc này, nên mặc định là `true`.
- `KiotClient.update`/`updateMany` (`lib/kiot.js:111-119`) đã nhận riêng `basePrice`.

## Yêu cầu

1. **Bỏ ghi Sapo.**
   - Máy chủ thật (`runtime.ts`) chạy `sapoWrite:false`: không đọc đối chiếu Sapo khi cập nhật, không PUT Sapo (cả giá lẫn mô tả).
   - Mã Sapo trong chỉ mục không còn là điều kiện để chọn hay cập nhật món.
   - Không gọi Sapo khi khởi động hay làm mới bảng nếu không còn chỗ nào cần. Code Sapo cũ giữ lại; đây là tắt bằng cấu hình, không xoá.
2. **Kiot chỉ ghi giá.**
   - Lệnh ghi Kiot (đơn lẻ và theo lô) chỉ gửi `basePrice`, không gửi `description`.
   - Thêm cờ `kiotDescription` (mặc định `false` ở máy chủ thật), theo mẫu `sapoDescription`. Cờ là `true` thì giữ hành vi cũ, để các test cũ còn dùng được.
   - Xác minh sau ghi: `currentPrice === giá mới` **và** mô tả Kiot giữ nguyên như lúc đọc trước khi ghi.
   - Bảo chốt (02/11/2026): "chỉ muốn thay đổi giá bán của kiot thôi mấy cái kia ko đụng tới". Lượt mới chỉ được đổi giá bán; mọi trường khác trên Kiot giữ nguyên.
   - Codex xem `rawFields` có chứa `description` không. Nếu PUT không có `description` làm mất mô tả trên Kiot, phải giữ nguyên mô tả cũ trong body. Ghi rõ cách đã chọn và có test.
3. **Ghi chú trên bảng vẫn hiện.**
   - Cột "Kết quả / Ghi chú" giữ ô xem: mô tả hiện tại trên Kiot (`notesBefore`) và ghi chú BAOQ dự kiến (`notePreview`).
   - Đổi chữ "Dự kiến — chưa ghi Kiot:" thành câu rõ nghĩa, ví dụ "Ghi chú tham khảo (không ghi lên Kiot):".
4. **Chữ trên trang.**
   - Nút: "Cập nhật giá Kiot (N món)".
   - Dòng tiến độ và tóm tắt Lịch sử không còn nhắc Sapo cho lượt mới.
   - Bước ghi: "Gửi giá" thay cho "Gửi giá và mô tả".
5. **Hoàn tác (rollback).**
   - Lượt mới (chỉ giá Kiot): chỉ trả lại giá Kiot cũ, không đụng mô tả.
   - Lượt cũ trước TASK-119 (đã ghi giá + mô tả hai bên): **giữ hành vi hoàn tác cũ** nếu vẫn chạy được. Nếu `sapoWrite:false` làm hoàn tác Sapo của lượt cũ không chạy được, đừng xoá hay làm hỏng dữ liệu: báo rõ trên trang ("Lượt cũ có Sapo — cần hoàn tác tay") và ghi trong result.
6. **Sapo giá 0.** Quy tắc TASK-118 ("bỏ qua cả hai") chỉ áp dụng khi còn ghi Sapo. Với luồng mới không đọc Sapo, món đó **được cập nhật giá Kiot như món thường**. Đây là giả định của Claude; ghi rõ trong result để Bảo duyệt.
7. **Giữ nguyên:**
   - quy tắc giá, `POLICY` (không cần đổi vì giá không đổi), ẩn hàng trước 01/07 và từ 600 triệu;
   - chạy nền (TASK-116), khoá có chủ (TASK-117), so dấu vân tay Kiot trước ghi;
   - Lịch sử TASK-114, "Cập nhật lại các món lỗi";
   - BossTele (đọc `pricing.js` và kho Kiot) không bị ảnh hưởng.

## Ngoài phạm vi

- Xoá code Sapo, chỉ mục Sapo, giới hạn Sapo (TASK-113). Chỉ tắt, không xoá.
- Đổi quy tắc giá hay mốc M.

## Test

- Lượt chỉ Kiot (đơn lẻ, theo lô, chạy nền): PUT Kiot chỉ có `basePrice` (hoặc mô tả cũ y nguyên nếu bắt buộc theo yêu cầu 2); không có GET hay PUT Sapo nào.
- Kiot trả mô tả khác sau ghi thì báo lỗi xác minh, không coi là thành công.
- Món có Sapo giá 0 hoặc không có trong chỉ mục Sapo vẫn cập nhật được giá Kiot.
- Hoàn tác lượt mới chỉ trả giá; lượt cũ theo yêu cầu 5.
- Trang: nút "Cập nhật giá Kiot (N món)"; ô ghi chú tham khảo vẫn hiện.
- Các test cũ cho luồng hai bên: giữ bằng `sapoWrite:true` / `kiotDescription:true` nếu được, hoặc chỉnh lại nhưng giữ ý nghĩa.
- E2E `src/tests/saleAiUpdateAll.test.ts` đạt; chỉnh cho luồng chỉ Kiot.

## Lệnh kiểm tra (Claude chạy)

- `npm run build` và `npm test` tại `D:\Website_3Q\Webstie`.
- `node --test` lõi Sale AI tại `server/src/sale-ai/test`.
- `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` tại `server`, 5 lần liên tiếp.
- `npm test` tại `BossTele`.

## Vùng code

`server/src/sale-ai/runtime.ts`, `core.js`, `lib/live.js`, `lib/joint-update.js`, `lib/batch-joint.js`, `lib/batch-update.js`, `lib/restore.js`, `lib/kiot.js` (chỉ nếu cần), `public/live-ui.js`, `public/app.js`, `test/*`, `src/tests/saleAiUpdateAll.test.ts`.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không gọi Kiot/Sapo thật. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-119-result.md`.

## Điểm cần Bảo duyệt sau

- Món Sapo giá 0 nay được cập nhật giá Kiot (yêu cầu 6).
- Hoàn tác lượt cũ có Sapo (yêu cầu 5).
