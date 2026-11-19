Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-137: Sale AI tự động cập nhật giá Kiot lúc 10:00, Thứ 2 đến Thứ 7

- Dự án: web (Sale AI trong `Webstie/server/src/sale-ai`)
- Người phụ trách: Codex (thực hiện), Claude (chạy test, review)
- Trạng thái: `ready`. Bảo yêu cầu 04/11/2026: "xây dựng tính năng cập nhật auto giá tự động mỗi 10h trừ chủ nhật".

## Bảo đã chốt (04/11/2026)

| Điểm | Chốt |
|---|---|
| Giờ chạy | **Mặc định 10:00 sáng giờ Việt Nam, Thứ 2–Thứ 7**, nghỉ Chủ nhật. **Bảo tự đổi giờ và bật/tắt được trên trang Sale AI** (hỏi 04/11: "tùy chỉnh giờ và tắt bật") |
| Máy chạy | **Laptop DESKTOP-4G5GOSR**. Chỉ một máy được bật, vì hai máy cùng bật sẽ ghi Kiot hai lần |
| Lỡ giờ (máy tắt hoặc ngủ lúc 10:00) | **Bỏ qua**, không chạy bù, đợi lần sau |
| Báo kết quả | **Chỉ Lịch sử Sale AI**, không nhắn Telegram |
| Mốc M | **Chỉ M1–M6.** M0 chỉ tính và hiện trên bảng, lượt tự động không ghi ("M0 chỉ tính thôi cập nhật lại làm chi") |
| Giá bị sửa tay trên Kiot | **Giữ giá tay, không ghi đè, ghi Lịch sử cho Bảo biết, chạy tiếp món khác** ("giữ giá báo tay nếu khác luồng auto và ghi lại lịch sử cho tui biết và tiếp tục chạy sản phẩm khác") |

## Bối cảnh

- Lịch tự động cũ (`lib/auto-schedule.js`, `/api/settings`, trang Thiết lập) đã bị gỡ ngày 21/10/2026 theo yêu cầu Bảo (`D:\BaoQ-AI\docs\CURRENT.md` mục "Lịch tự động đã gỡ bỏ"). Tài liệu ghi chỉ mở lại khi Bảo yêu cầu, và nay Bảo yêu cầu. Lịch sử còn nhãn `trigger==='schedule'` → "Tự động cập nhật" (`public/live-ui.js:99-104`).
- Luồng tay hiện tại, giữ nguyên:
  1. "Tải lại từ Kiot": `POST /api/kiot/refresh` → `refreshTableWork` (`core.js:96`).
  2. Bảng hôm nay: `ensureCurrent(real)`.
  3. "Chọn tất cả mọi trang": `GET /api/kiot/selection` (`core.js:120-123`). Lấy món `status==='simulated'`, bỏ món đã đúng giá (TASK-125).
  4. Cập nhật nền: `POST /api/kiot/update` → `live.prepare(…,{localOnly:true,continueOnError:true})` rồi `live.commit(…,true)` (`core.js:148-153`). Chỉ ghi giá Kiot (TASK-119), theo lô 50 (TASK-120/126), xác minh sau ghi.

## Yêu cầu

1. **Bộ hẹn giờ** trong máy chủ Sale AI (`runtime.ts` / `core.js`, cạnh `keepCurrent` 15 giây):
   - Đến **giờ đã cài** (mặc định 10:00) theo giờ Việt Nam (dùng `vietnamTime`, không theo múi giờ máy), ngày Thứ 2–Thứ 7, nếu lịch đang **Bật**, thì chạy **một lượt** tự động.
   - Mỗi ngày tối đa một lượt tự động. Ghi ngày đã chạy vào kho, để khởi động lại máy chủ trong ngày không chạy lại.
   - **Lỡ giờ thì bỏ:** chỉ chạy khi thời điểm kiểm tra nằm trong cửa sổ ngắn sau giờ đã cài (ví dụ 5 phút). Máy chủ bật trễ hơn thì không chạy hôm đó. Ghi rõ độ dài cửa sổ.
   - Đổi giờ trong ngày: nếu giờ mới còn ở phía trước và hôm nay chưa chạy thì chạy theo giờ mới; nếu hôm nay đã chạy thì không chạy lại.
   - Chủ nhật không chạy.
2. **Một lượt tự động**, cùng các bước như Bảo bấm tay:
   1. Tải lại từ Kiot.
   2. Dựng bảng hôm nay.
   3. Lấy danh sách như "Chọn tất cả mọi trang", **bỏ mọi món M0** (`row.m===0`). Chỉ giữ M1–M6 có giá Kiot khác giá dự kiến. Món M0 không vào lượt và không tính là lỗi.
   4. Cập nhật nền chỉ giá Kiot.
   - Lượt ghi `trigger:'schedule'` để Lịch sử hiện "Tự động cập nhật".
   - Không có món nào cần đổi giá thì vẫn ghi một dòng Lịch sử, ví dụ "Tự động cập nhật · 0 món cần đổi giá".
3. **Giá bị sửa tay: giữ, báo, chạy tiếp** (chỉ trong lượt tự động; luồng bấm tay không đổi):
   - **Giá Sale AI mong thấy** của một món là giá Sale AI ghi và xác minh thành công gần nhất cho món đó, lấy từ nhật ký `updates`, kể cả lượt bấm tay. Món chưa từng được Sale AI ghi thì là P0 (`p.p0`).
   - Sau khi tải lại từ Kiot, nếu giá Kiot hiện tại **khác** giá mong thấy, nghĩa là có người sửa ngoài Sale AI. Lượt tự động **không ghi** món đó và đánh dấu trạng thái riêng, ví dụ `skipped_manual_price`, kèm lý do "Giá Kiot bị sửa tay: hiện X, Sale AI ghi lần trước Y, dự kiến hôm nay Z".
   - Món này **không tính là lỗi**, không vào "Cập nhật lại các món lỗi", và **không làm dừng lượt**: các món khác vẫn chạy bình thường.
   - Lịch sử: dòng tóm tắt thêm "· N giữ giá sửa tay". "Xem chi tiết" có tab "Giữ giá sửa tay (N)" liệt kê từng món với giá hiện tại, giá Sale AI ghi trước và giá dự kiến.
   - Bảo vẫn bấm tay cập nhật được món đó trên bảng như hiện nay. Lần ghi tay thành công trở thành giá mong thấy mới, nên các ngày sau luồng tự động chạy lại bình thường cho món đó.
4. **An toàn**, không bỏ bước nào của luồng tay:
   - Dùng đúng khoá ghi, kiểm tra policy và dấu vân tay, xác minh sau ghi, `unknown` không gửi lại.
   - Đang có lượt khác chạy (Bảo bấm tay, `busy`) thì **không chạy chồng**. Ghi Lịch sử "Bỏ qua: đang có lượt khác", không thử lại trong ngày.
   - Tải lại từ Kiot thất bại thì không cập nhật. Ghi Lịch sử lỗi.
   - **Ngưỡng dừng:** nếu số món cần đổi giá vượt một ngưỡng (đề xuất 2.000) thì không ghi. Ghi Lịch sử "Dừng: số món bất thường (N) — cần kiểm tra tay". Đặt thành hằng số, có test.
5. **Bật/tắt, đổi giờ, và chỉ một máy:**
   - **Hai lớp:**
     - (a) **Máy được phép chạy lịch:** biến môi trường `SALE_AI_AUTO_UPDATE=1` trong `server/.env`. Bảo tự thêm trên Laptop; Codex và Claude không đọc hay sửa `.env`. Máy không có biến (PC) không bao giờ tự cập nhật, dù công tắc trên giao diện là Bật.
     - (b) **Cài đặt trên giao diện:** công tắc Bật/Tắt và giờ chạy `HH:MM`. Lưu trong kho Sale AI (`server/data/sale-ai`), giữ qua khởi động lại. **Mặc định Tắt, 10:00.**
   - API mới, ví dụ `GET/POST /api/auto-update/settings`:
     - cùng điều kiện đăng nhập và quyền như cập nhật giá (`sale.manage`), cùng nguồn (`requireSameOrigin` đã có ở route `/sale-ai`);
     - kiểm tra giờ hợp lệ `00:00`–`23:59`, chỉ nhận đúng các trường `enabled`, `time`;
     - ghi nhật ký web (audit log): ai đổi, đổi gì, lúc nào, nếu web có sẵn cách ghi audit cho Sale AI; nếu không có thì ghi vào kho Sale AI và hiện trong Lịch sử.
   - Ghi chú trong `docs`/README cách bật lớp (a), kèm cảnh báo chỉ bật trên một máy.
6. **Hiển thị trong Sale AI:**
   - Một dòng ở đầu trang Kết quả gồm:
     - trạng thái: "Tự động cập nhật: Bật · 10:00 T2–T7 · Lần tới: 10:00 Thứ 5, 05/11 · Máy: Laptop", "Đang chạy" khi có lượt tự động, hoặc "Tắt";
     - **công tắc Bật/Tắt**;
     - nút **"Đổi giờ"** mở ô chọn giờ (`<input type="time">`) với nút Lưu và Huỷ.
   - Bật hoặc đổi giờ phải có bước xác nhận ngắn ngay trên trang (không dùng `confirm()`), ví dụ "Từ mai, 10:00 T2–T7 máy sẽ tự ghi giá Kiot cho món M1–M6. Bật?".
   - Trên máy không có lớp (a), dòng này ghi "Máy này không chạy lịch (chỉ Laptop)". Công tắc và nút Đổi giờ bị khoá, có chú thích.
   - Lịch sử hiện các lượt tự động như hiện tại (nhãn có sẵn), có dòng tóm tắt TASK-114 và nút "Xem chi tiết". "Cập nhật lại các món lỗi" dùng được cho lượt tự động.
   - Không cho đổi ngày trong tuần (luôn T2–T7) trong task này.
7. **Không đổi:** quy tắc giá và POLICY, ẩn hàng trước 01/07 và từ 600 triệu, chỉ ghi giá Kiot, không Sapo, ghi theo lô, khoá, phục hồi khi gián đoạn, BossTele.

## Test (đồng hồ giả, Kiot giả)

- Thứ 2 10:00:30 → chạy đúng một lượt `trigger:'schedule'`; 10:00:45 cùng ngày → không chạy thêm; khởi động lại lúc 10:02 cùng ngày → không chạy lại.
- Chủ nhật 10:00 → không chạy.
- Công tắc Tắt (có lớp a) → không chạy. Bật lại → hôm sau chạy theo giờ đã cài.
- Đổi giờ sang 14:30 → chạy lúc 14:30, không chạy 10:00. Đổi giờ sau khi hôm nay đã chạy → không chạy lại hôm nay.
- API cài đặt: chưa đăng nhập hoặc không có `sale.manage` thì bị chặn; giờ sai (`25:00`, `abc`, thiếu) thì 400; trường lạ bị từ chối; cài đặt giữ sau khởi động lại.
- Máy không có lớp (a), công tắc Bật → vẫn không chạy; giao diện khoá công tắc.
- Bảng có món M0 lệch giá và món M1–M6 lệch giá → lượt tự động chỉ PUT món M1–M6; món M0 không có trong lượt. Luồng bấm tay không đổi.
- Món M2 mà Sale AI đã ghi 32.200.000, Kiot nay là 30.000.000 (sửa tay) → không PUT, trạng thái `skipped_manual_price`, có trong tab "Giữ giá sửa tay"; các món khác trong cùng lượt vẫn PUT và `done`.
- Món chưa từng được Sale AI ghi, giá Kiot ≠ P0 → giữ, báo như trên. Giá Kiot = P0 → ghi bình thường.
- Sau khi Bảo bấm tay cập nhật món bị giữ, lượt tự động hôm sau coi đó là giá mong thấy và chạy bình thường.
- `retry-selection` không lấy món `skipped_manual_price`.
- Máy chủ bật lúc 10:30 (ngoài cửa sổ) → không chạy hôm đó; hôm sau 10:00 chạy.
- Giờ máy khác múi (UTC) → vẫn theo 10:00 giờ Việt Nam.
- Không có `SALE_AI_AUTO_UPDATE=1` → không bao giờ chạy.
- Đang `busy` → bỏ qua, ghi Lịch sử, không ghi Kiot.
- Tải lại Kiot lỗi → không PUT, ghi Lịch sử lỗi.
- Vượt ngưỡng → không PUT, ghi Lịch sử dừng.
- 0 món cần đổi → không PUT, có dòng Lịch sử.
- Lượt tự động có lỗi một phần → "Cập nhật lại các món lỗi" lấy đúng món.
- E2E `saleAiUpdateAll.test.ts` vẫn đạt.

## Lệnh kiểm tra (Claude chạy)

`npm run build`, `npm test` tại `Webstie`; `node --test` lõi Sale AI; E2E 5 lần; BossTele `npm test`.

## Vùng code

`server/src/sale-ai/runtime.ts`, `core.js`, `lib/live.js`, `lib/service.js`, `lib/view-data.js`, `public/app.js`, `public/live-ui.js`, `test/*`, `src/tests/saleAiUpdateAll.test.ts`; `server/src/config/env.ts` nếu đọc biến môi trường ở đó; tài liệu chạy.

## Cách làm

- Codex chạy `-a never`. Lệnh bị sandbox chặn thì ghi lại, không xin quyền.
- Không gọi Kiot/Sapo thật. Không đọc hay sửa `.env`. Không dừng hay khởi động lại server. Không commit.
- Ghi kết quả vào `tasks/TASK-137-result.md`.

## Sau khi Codex xong (việc của Bảo)

- Thêm `SALE_AI_AUTO_UPDATE=1` vào `Webstie/server/.env` **trên Laptop**, rồi khởi động lại web.
- Vào Sale AI, bấm công tắc **Bật**, chỉnh giờ nếu cần.
- **Không** thêm biến này trên PC.

## Mẫu giao diện Bảo đã duyệt (04/11/2026)

`tasks/TASK-137-demo.html`: dòng trạng thái, công tắc, "Đổi giờ", khung xác nhận, trạng thái PC bị khoá, các kiểu dòng Lịch sử. Làm theo mẫu, dùng style có sẵn của Sale AI (walnut).
