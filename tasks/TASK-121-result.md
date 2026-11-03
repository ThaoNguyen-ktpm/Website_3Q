Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-121 — Kết quả

- Dự án: web / Sale AI.
- Người thực hiện: Codex.
- Trạng thái: `ready_for_review`; chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: hoàn thiện phần triển khai còn thiếu, giữ test và kế hoạch hữu ích của lượt trước; kiểm tra transport, journal và UI bằng fixture cô lập.
- Bước tiếp theo: Claude chạy build/test đầy đủ và E2E 5 lần trong môi trường cho phép tạo tiến trình con.

## Thay đổi

1. `Webstie/server/src/sale-ai/lib/kiot.js`: transport mặc định `kiotFetch` dùng `node:http`/`node:https`, không dùng parser undici. Bắt lỗi ở cả request và response, kiểm tra body hoàn chỉnh, không đi theo redirect, timeout bao phủ cả body. Bỏ header `Connection: close` tự đặt. Không thêm dependency.
2. Giữ giao diện fetcher được tiêm cho test. Auth, GET và PUT của Sale AI dùng transport mới. GET bị reset socket được thử lại tối đa hai lần như trước; PUT chỉ gửi một lần. Lỗi mạng/JSON rỗng/cụt của PUT có `uncertain=true`, đi vào `unknown`, không tự gửi lại. Timeout vẫn 30 giây mỗi request.
3. `runtime.ts`: bỏ override `client.all()` qua `catalogStore.sync()`, vì nhánh đó vẫn đi qua fetch của BossTele. Refresh đầy đủ của riêng Sale AI giờ cũng dùng KiotClient native, đọc cùng nguồn Kiot và lọc tồn/active như trước. Không sửa luồng Tìm kiếm của website. Đây cũng bảo đảm mốc bắt đầu đọc bảng cho TASK-122 không bị sai do đồng bộ danh mục được gộp với một lượt đã chạy trước đó.
4. `server.ts`, `runtime.ts`, `core.js`: xử lý `uncaughtException`/`unhandledRejection` bằng đường thoát có giới hạn 5 giây. Log nguyên nhân đã che bí mật, dừng nhận công việc, chặn network/ghi mới của Sale AI, chờ các write đang thực hiện, phục hồi từ checkpoint bền vững rồi thoát mã 1. Không tiếp tục sử dụng tiến trình lỗi. Hết hạn hoặc phục hồi lỗi đều có log; lần khởi động sau vẫn có đường phục hồi cũ.
5. `lib/service.js`: tách `recoverInterrupted()` dùng chung cho khởi tạo và fatal. `ready` chưa gửi thành `not_sent`; `sending` hoặc có khả năng đã gửi thành `unknown`; attempt/outcome thành `interrupted`. `lib/live.js` và tracked store chặn thao tác đến muộn ghi đè journal đã phục hồi.
6. `public/app.js`: lỗi fetch/JSON của API được chuyển sang câu tiếng Việt hướng dẫn xem Lịch sử; giữ AbortError và lỗi nghiệp vụ. Poll status khi mất kết nối thay tiến độ cũ bằng thông báo, chỉ báo một lần mỗi đợt mất kết nối, tiếp tục thăm dò để kết nối lại.

Nguyên nhân theo log trong spec là assertion ngoài promise của parser undici khi TLS socket kết thúc. Không khẳng định đã tái tạo đúng assertion nội bộ đó: đã tái tạo được socket đóng giữa body trên HTTP cục bộ. Chọn native transport để loại parser đó khỏi đường Kiot của Sale AI; chỉ bỏ header không đủ bằng chứng để kết luận đã xử lý tận gốc.

## Kiểm tra thực tế

Tại `Webstie/server`:

```powershell
node --test --test-isolation=none src/sale-ai/test/kiot-transport.test.js src/sale-ai/test/background-ui.test.js src/sale-ai/test/runtime-fatal.test.js src/sale-ai/test/kiot-price-only.test.js src/sale-ai/test/kiot-batch-runtime.test.js src/sale-ai/test/batch-speed.test.js
```

Nhóm tập trung đạt 42/42 sau thay đổi cuối. Bao gồm HTTP cục bộ ngắt body, GET thử lại, PUT không thử lại; lô đầu mất socket thành `unknown`, lô kế tiếp hoàn tất; JSON rỗng/cụt; deadline khi body treo; bảo toàn mô tả và hoàn tác; lỗi API/polling; fatal recovery có giới hạn và log che bí mật.

```powershell
node --test --test-isolation=none --test-name-pattern="fatal interruption|shutdown drains|background batch catches|background failure" src/sale-ai/test/background-update.test.js
```

Đạt 4/4: phục hồi journal đang gửi/chưa gửi, không cho phản hồi muộn ghi đè, từ chối job mới sau interrupt, shutdown và lỗi nền quan sát được.

`npx.cmd tsc -p tsconfig.json --noEmit`: đạt. `git diff --check`: đạt, chỉ có cảnh báo chuyển LF/CRLF từ các file trong working tree.

## Giới hạn / bàn giao

- `npm.cmd run build` tại `Webstie`: server build và frontend typecheck đạt; Vite frontend bị `spawn EPERM` khi khởi động esbuild.
- `npm.cmd test` tại `Webstie`: Playwright frontend bị `spawn EPERM`, chưa tới server suite.
- `npx.cmd vitest run src/tests/saleAiRuntime.test.ts src/tests/saleAiUpdateAll.test.ts`: bị `spawn EPERM` khi nạp config/esbuild. Không có bằng chứng E2E đạt, chưa chạy được E2E 5 lần. Test runtime bằng Vitest đã bổ sung; đường fatal tương ứng được kiểm tra riêng bằng Node/fixture, không thay thế E2E.
- Không chạy full core in-process. Có lần chạy nhóm tập trung vô tình gồm benchmark 5.000 món cũ; lần đó đạt cùng nhóm 48/48 trong khoảng 55 giây, không phải toàn bộ core. Các lượt dừng kiểm tra tập trung không được tính là bằng chứng đạt; không dừng server.
- Review tĩnh tập trung không phát hiện lỗi đáng kể; đây không phải review độc lập của Claude.
- Không gọi Kiot/Sapo thật, không đọc/in khóa, không bật bot, không dừng/khởi động lại server, không commit. Không xác minh TLS Kiot thật hay hành vi trên tiến trình production. Server đang chạy chưa được chủ động nạp lại bởi lượt này.

## Sua theo review

Máy: Laptop (DESKTOP-4G5GOSR)

- Ngày: 02/11/2026. Trạng thái: `ready_for_review`; phần sửa này chưa được Claude kiểm tra độc lập.
- Đã đọc AGENTS.md, README, spec và review `changes_requested`. Tái hiện trước sửa: hai file test được review nêu chạy bằng `node --test --test-isolation=none` đạt 12/15, lỗi đúng 3 test trong review.
- Nguyên nhân đã xác nhận: assertion `Connection: close` trong hai fetcher tiêm vào ném `ERR_ASSERTION` trước khi chạy nhánh mô phỏng `cause.code=UND_ERR_SOCKET`. `KiotClient` bọc lỗi assertion đó thành `NETWORK_ERROR`, khiến kết quả trông như mất retry. Test HTTP cục bộ đã phục hồi GET và đủ hai request, chỉ lỗi kỳ vọng header. Test lỗi socket kéo dài vẫn đạt trước sửa; logic hiện có đã nhận cả `cause.code` và `error.code`, giới hạn GET hai lần, PUT một lần.
- Chỉ đổi đúng ba kỳ vọng header: `kiot-errors.test.js` kiểm tra header tự đặt là `undefined` và header nhận ở HTTP cục bộ là `['keep-alive','keep-alive']`; `batch-update.test.js` kiểm tra header tự đặt là `undefined`. Đây là thay đổi có chủ đích theo spec bỏ `Connection: close`. Không sửa code ứng dụng; giữ nguyên mọi assertion khác, số lần gọi, mã lỗi, chặn gửi lại PUT, kết quả giá và `lastReadRecovery`. Các thay đổi khác đã có sẵn trong working tree được giữ nguyên.

Kiểm tra tại `Webstie/server`:

```powershell
node --test --test-isolation=none src/sale-ai/test/kiot-errors.test.js src/sale-ai/test/batch-update.test.js
```

Sau sửa đạt 15/15, không lỗi, không bỏ qua. Bao gồm đủ ba test từng lỗi trong review.

```powershell
node --test --test-isolation=none src/sale-ai/test/kiot-errors.test.js src/sale-ai/test/batch-update.test.js src/sale-ai/test/kiot-transport.test.js src/sale-ai/test/kiot-batch-runtime.test.js
```

Đạt 36/36, không lỗi, không bỏ qua: GET phục hồi với lỗi undici qua fetcher tiêm vào và lỗi native giữa body; GET lỗi liên tục dừng sau hai lần; PUT không thử lại; lô mất socket thành `unknown`, lô tiếp theo hoàn tất. Chỉ dùng fixture và HTTP loopback, không gọi Kiot/Sapo thật.

- `npm.cmd run build` tại `Webstie`: server build và frontend typecheck đạt; Vite không nạp được config vì esbuild bị sandbox chặn `spawn EPERM` (exit 1).
- `npm.cmd test` tại `Webstie`: bị sandbox chặn `spawn EPERM` khi Playwright tạo worker, chưa chạy tới server suite (exit 1). Không coi đây là bằng chứng toàn bộ test đạt.
- `git diff --check`: exit 0; chỉ cảnh báo LF/CRLF ở các thay đổi có sẵn. Không chạy full core, E2E ×5 hay BossTele trong lượt sửa header này.
- Không xin approval, không đọc/in khóa, không gọi Kiot/Sapo thật, không dừng/khởi động lại server, không commit. Chưa xác minh trên Kiot thật; bước tiếp theo là Claude review độc lập phần sửa và chạy lại kiểm tra đầy đủ trong môi trường cho phép tiến trình con.
