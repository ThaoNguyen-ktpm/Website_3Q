Script thử biên cần bạn phê duyệt nên chưa chạy được. Tôi hoàn tất review bằng cách đọc code (static); phần nào chỉ kiểm bằng cách đọc code đều được ghi rõ bên dưới.

---

# TASK-007 — Review của Claude

- **Người review:** Claude (review độc lập)
- **Ngày:** 2026-10-14
- **Kết luận:** `verified`. Có 1 lỗi Low không chặn nghiệm thu và 2 ghi chú cho seam AI sau này.

## Phạm vi đã xem
`AGENTS.md`, `CLAUDE.md`, `tasks/TASK-007-spec.md`, `tasks/TASK-007-result.md`, `docs/CHAT.md`, `chat.js`, `lib/chat-commands.js`, `lib/target-price.js`, `lib/search-cache.js`, `lib/chat-session.js`, `lib/pricing-ai.js`, `lib/product-search.js`, `test/chat.test.js`, `package.json`, `tasks/TASK-007-live.json`. Tôi đã grep mọi nơi gọi `createProductSearch` / `startPage`. Không đọc `.env`, `connections.local.json` hay credential. Không gọi API thật và không sửa file nào.

## Bằng chứng

### Test do Claude tự chạy (chỉ dùng fixture/mock)
- Lệnh `npm.cmd test` tại `D:\BossTele`: **tests 60, pass 60, fail 0**, thời gian khoảng 2,7 giây. Transport là mock, không gọi model.
- Tôi muốn chạy thêm một script thử biên ngoài dự án (lỗi nguồn ở lần tìm đầu, ký tự bidi, đối chiếu phân số margin, provider trả `undefined`). Lệnh cần phê duyệt nên **chưa chạy**. Các mục liên quan bên dưới chỉ được kiểm chứng bằng cách đọc code.

### Bằng chứng live do Codex cung cấp (Claude không chạy lại)
- `tasks/TASK-007-live.json`:
  - Tìm theo tên trả 10 dòng từ cả Kiot và Web.
  - `xem thêm` dùng 0 request mới.
  - Tìm SKU Kiot `SP022466` thấy 1 dòng.
  - Tìm SKU Sapo thấy 1 dòng, kèm cảnh báo chưa quét hết danh mục.
  - Phép tính ra 168750000, AI `disabled`, `aiCalls=0`.
  - `apiRequests=4` khớp với 2 (tên) + 1 (SKU Kiot) + 1 (SKU Sapo).
- Các số trên nhất quán với nhau. Đây vẫn là bằng chứng live của Codex, không phải kiểm chứng độc lập của Claude.
- Live chưa chạy hai trường hợp: lấy trang 2 thật qua API, và quét tiếp SKU Sapo sang trang 2. Hai trường hợp này mới chỉ có fixture (`test/chat.test.js:54-72`, `:158-170`).

## Đối chiếu kế hoạch đã duyệt

| Yêu cầu | Kết quả | Căn cứ |
|---|---|---|
| Parser chặn câu ngoài phạm vi trước khi gọi API/AI | Đạt | `chat-session.js:69-70` trả `blocked` trước mọi nhánh. Regex dùng neo `^…$`, chặn ký tự điều khiển, chặn hơn 500 code point (`chat-commands.js:7`). Test với provider spy đang bật cho API=0, model=0 (`chat.test.js:40-52`). |
| Tính toán BigInt chính xác | Đạt | Tỷ lệ được đổi thành phân số `rateInteger/scale`, rồi làm tròn lên bằng `(n+d-1)/d` (`target-price.js:9-18`). Không đi qua `Number`. Parser chỉ nhận `\d` ASCII. Vốn bằng 0 và margin ≥ 100 bị chặn ngay ở parser, nên `calculateTargetPrice` không thể ném lỗi trong runtime. |
| 10 dòng mỗi lần, xen kẽ nguồn | Đạt | `chat-session.js:43-49` |
| Phân trang và buffer | Đạt | Chỉ lấy trang mới khi mọi queue đã rỗng (`:82-84`). Nguồn lỗi được thử lại đúng trang cũ vì `page` không tăng khi lỗi (`:30-35`). SKU Sapo quét từng trang (`maxPages:1`, `startPage=page`). |
| Cache TTL 120 giây, tối đa 50, không cache lỗi | Đạt | `search-cache.js:10,15,18`. Exception và dữ liệu sai định dạng được đổi thành `error` nên không vào cache (`chat-session.js:24-27`). Cache key gồm nguồn, loại, query và trang. |
| Chọn sản phẩm mới thì xóa phép tính | Đạt | `chat-session.js:76,90`. `phân tích giá` yêu cầu có cả sản phẩm đã chọn và phép tính (`:97`). |
| AI tắt, payload tương lai theo whitelist | Đạt | `pricing-ai.js:8-13`. Bộ đếm chỉ tăng khi provider thật sự được gọi. Test xác nhận payload không chứa secret hay lịch sử chat (`chat.test.js:101-109`). |
| Chế độ `all` không gồm POS, caller cũ không đổi hành vi | Đạt | `chat-session.js:74`. `search-products.js` không truyền `startPage`, nên mặc định là 1 như trước. |

## Lỗi

### L1 — Low (không chặn): nguồn lỗi ngay ở lần tìm đầu vẫn báo "còn kết quả"
- **Vị trí:** `lib/chat-session.js:75` và `:57`
- **Nguyên nhân:** `hasMore` được khởi tạo là `true`. Khi lần lấy đầu tiên lỗi, `fetchPage` thoát ra ở `:30-32` mà không cập nhật `hasMore`. Dòng `:57` vì vậy vẫn in `"<nguồn>: còn kết quả/trang chưa xem; gõ “xem thêm”."`.
- **Cách tái hiện (suy từ code, chưa chạy):** tạo `createChatSession` với mock `search` trả `[{status:'error', message:'Khóa hết hạn.'}]` cho `sapo-web` và `[{status:'ok', items:[], hasMore:false}]` cho `kiotviet`, rồi gửi `tìm tên "X"`.
  - Kết quả hiện tại: messages có cả dòng lỗi lẫn câu "sapo-web: còn kết quả/trang chưa xem…", dù chưa đọc được trang nào.
- **Ảnh hưởng:** chỉ là câu chữ gây hiểu nhầm. Câu tổng quát "chưa thể kết luận…" ở `:60-61` vẫn đúng.
- **Gợi ý sửa:** ở `:57`, khi `entry.error` có giá trị thì in "gõ “xem thêm” để thử lại" thay cho câu "còn kết quả".

## Ghi chú (chưa phải lỗi ở runtime hiện tại)
- **N1:** `chat-session.js:99` đọc `result.message` mà không kiểm tra. Nếu provider sau này trả `undefined`, sẽ có `TypeError` và `runChat` kết thúc cả phiên. Hiện tại AI không thể bật nên chưa xảy ra. Nên xử lý khi nối provider thật.
- **N2:** `safeText` (`chat.js:10`) chỉ lọc ký tự điều khiển C0/C1. Các ký tự định dạng Unicode (bidi U+202E, zero-width) từ tên sản phẩm trên API vẫn được in ra terminal. Điều này đúng với cam kết "lọc ký tự điều khiển" trong tài liệu, nhưng nên cân nhắc nếu dữ liệu sản phẩm có thể đến từ nguồn không tin cậy.

## Kết luận
**`verified`**: mọi tiêu chí trong kế hoạch đã duyệt khớp với code thực tế và với 60/60 test do Claude tự chạy bằng fixture. Bằng chứng live là của Codex. L1 không chặn nghiệm thu; Codex có thể sửa trong lượt tới.

---

- **Chưa kiểm tra:** script thử biên chưa chạy vì chưa được phê duyệt, nên L1, N1 và N2 chỉ dựa trên đọc code. Tôi không chạy lại phần live.
- **Rủi ro cần biết:** lấy trang 2 thật và quét SKU Sapo nhiều trang mới được kiểm bằng mock, chưa thử với API thật.