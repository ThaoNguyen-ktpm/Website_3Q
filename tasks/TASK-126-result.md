Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-126 — Kết quả triển khai

- Dự án: web / Sale AI.
- Người thực hiện: Codex; ngày 02/11/2026.
- Trạng thái: `ready_for_review`. Đã triển khai, viết test và đo offline trước/sau; **chưa đạt toàn bộ mục tiêu hiệu năng**: `saveMs` cuối 5,527 giây, vượt ngưỡng 5 giây. Chưa được Claude kiểm tra độc lập.
- Hành động gần nhất: đo bản cuối trên SplitStore ở thư mục tạm, kiểm cú pháp 11 file và whitespace; rà source độc lập bằng agent chỉ đọc.
- Bước tiếp theo: Claude chạy các bộ kiểm tra trong spec, kiểm chứng test mới/cũ và E2E 5 lần; xác nhận giới hạn `saveMs` trước khi nghiệm thu.

## Thay đổi

1. **Mốc đọc và thông báo** — `Webstie/server/src/sale-ai/lib/live.js`, `lib/batch-joint.js`:
   - Giữ mốc bắt đầu đọc Kiot, không suy mốc từ thời điểm xác nhận. Luồng nền vẫn dùng `listModified(mốc - MODIFIED_MARGIN_MS)` và cổng kiểm snapshot của TASK-125.
   - Khắc phục nhánh làm mới tự động không đổi sản phẩm: tạo bản hiện hành mới của bảng với `liveReadAt` vừa đọc, không sửa object snapshot cũ. Bảng cũ thiếu mốc được nâng cấp sau làm mới; tải lại thông thường vẫn tăng revision và dựng lại bảng theo luồng hiện có.
   - Khi thật sự thiếu mốc, trước `all()` hiển thị đúng thông báo: “Đang đọc toàn bộ Kiot (~30 giây) vì bảng chưa có mốc; bấm Tải lại từ Kiot để lần sau nhanh hơn”. Giao diện tiến độ hiện có đã render/escape stage nên không cần sửa HTML/CSS hoặc `public/app.js`.

2. **Nhật ký gọn và chia khối** — thêm `lib/journal-storage.js`, `lib/kiot-fingerprint.js`; sửa `lib/split-store.js`, `lib/live.js`, `lib/restore.js`:
   - Chỉ lượt mới chỉ giá Kiot có `journalVersion: 2` dùng dạng gọn. Nhật ký cũ và nhật ký có Sapo/mô tả tiếp tục giữ định dạng cũ.
   - Mỗi món giữ mã/ID/tên, giá trước/sau, fingerprint trước/sau, trạng thái/lỗi/chẩn đoán/thời điểm và dữ liệu hàng giá cần thiết; bỏ bản chép `rawSource`, `rawFields`, `notePreview`, `desiredNote`, `row.notesBefore` trong bản ghi trên đĩa.
   - Với lượt chỉ giá, mô tả không cần gửi lại khi hoàn tác: lưu hash mô tả để vẫn chặn thay đổi mô tả sau ghi, thay vì chép mô tả nhiều lần. Lượt cũ có ghi mô tả vẫn giữ nguyên before-image và hoàn tác theo nhánh cũ.
   - Fingerprint sau ghi được dùng khi đối chiếu nhật ký gọn đã mở lại kho, giữ kiểm tra đầy đủ tên/mô tả/tồn kho/rawFields của TASK-125. Không dùng riêng giá đúng để chấp nhận sửa tay.
   - `updates` trỏ tới descriptor `baoq-update-chunks-v1`; `items` và báo cáo từng attempt lưu thành các blob khối tối đa 50 món. Nội dung không đổi tái sử dụng hash; chỉ khối thay đổi được ghi mới. Worker ghi khối tối đa 8, chờ tất cả kết thúc kể cả khi lỗi trước khi công bố manifest.
   - Đọc kho dựng lại cùng cấu trúc `updates[].items` / `attempts[].items` mà API lịch sử, chọn lỗi và phục hồi đang dùng. Không thay giao diện của các API đó.

3. **Giảm ghi và giữ snapshot** — `lib/live-draft.js`, `lib/service.js`, `lib/live.js`, `lib/split-store.js`:
   - Draft đầu transaction vẫn clone sản phẩm được chọn. Khi checkpoint/công bố kết quả, sản phẩm bằng bản đã công bố được tái sử dụng để cache immutable không phải serialize lại toàn bộ 1.311 sản phẩm mỗi lô; sản phẩm thay đổi vẫn clone để cách ly.
   - Blob bảng `runs` trên 65.536 byte UTF-8 được nén lossless bằng gzip chuẩn Node, bọc JSON `baoq-gzip-run-v1`. Đọc kho giải nén và khôi phục đầy đủ rows; bảng cũ JSON thường vẫn đọc được. Không đổi nội dung snapshot/API, không thêm dependency.
   - Nén bảng là cần thiết từ bằng chứng: bản chỉ chia nhật ký vẫn tăng 23,19 MB dữ liệu được tham chiếu/lượt, phần lớn do thêm snapshot bảng lớn. Bản cuối còn tăng 2,24 MB.
   - Giữ nguyên điểm lưu “đang gửi” trước PUT, kết quả ở checkpoint kế tiếp trước PUT tiếp theo hoặc lần công bố cuối. Lỗi lưu vẫn đóng cổng gửi. Không thay lô 50, transport, retry, quy tắc giá hay xác minh sau PUT.

4. **Dọn blob** — `lib/store-cleanup.js`, `lib/split-store.js`, `lib/service.js`:
   - Audit theo cả tham chiếu khối con của nhật ký; kiểm hash/định dạng trước khi xác định ứng viên xoá. Đọc kiểm tra blob tối đa 8 worker và chờ kết thúc đầy đủ khi lỗi.
   - Sau công bố cuối lượt, hoặc lần lưu tiếp theo sau mở kho, dọn blob không tham chiếu ngay dưới khóa ghi đang giữ. Nhánh này không cần audit lại nhiều lần như quy trình audit → duyệt plan → apply offline. `applyPlan` offline vẫn giữ cơ chế khóa/bảo vệ hiện có.
   - Lỗi dọn không biến dữ liệu đã công bố thành lỗi ghi; ghi cảnh báo và thử ở lần lưu sau, vô hiệu cache khi đã có thể xoá blob.
   - Giữ chính sách `retainRuns` hiện có: 7 bảng mới nhất và bảng được bảo vệ bởi xác nhận/lượt đang chạy. Không tự cắt lịch sử cập nhật.
   - **Chỉ chạy dọn trong kho tạm của phép đo. Không chạy dọn, đọc hoặc xoá dữ liệu thật dưới `server/data/`.**

5. **BossTele**:
   - Đã đọc `Webstie/BossTele/AGENTS.md` và `sale-price.js:28-36`: bot chỉ đọc metadata `policy`/`loadedAt`, chỉ mục `products` và blob sản phẩm JSON thường.
   - Giữ nguyên manifest `baoq-split-v1` và định dạng products/index. Không sửa BossTele hoặc `pricing.js` trong TASK-126. Các thay đổi có sẵn của TASK-125 và các task trước được giữ lại.

## Phép đo trước/sau thực tế

Script: `tasks/TASK-126-benchmark.mjs`. Client hoàn toàn giả, không HTTP/credential: 4.800 sản phẩm chuẩn hoá, chọn 1.311 món, 27 PUT lô; 59 trang `all()` × 600 ms, PUT × 700 ms, `listModified` × 400 ms. Dùng độ trễ wall-clock thật và SplitStore thật, có fsync/rename/khóa trong thư mục tạm Windows. Ngày tính cố định trong fixture là 16/11/2026; không thay đồng hồ máy.

| Chỉ số | Trước sửa | Bản cuối sau sửa |
|---|---:|---:|
| Mốc của bảng | Không có, mô phỏng bảng cũ | Có mốc đọc tin cậy |
| Tổng lượt, gồm prepare | 76.938,43 ms | 38.464,20 ms |
| Đọc đầu lượt | 36.469 ms | 403 ms |
| `saveMs` commit, gồm dọn cuối | 7.451,77 ms | **5.526,96 ms** |
| Dọn cuối, nằm trong `saveMs` | Không dọn cuối lượt | 1.494,96 ms |
| PUT lô / `listModified` / `all()` | 27 / 28 / 1 | 27 / 28 / 0 |
| Nhật ký cuối, tính descriptor + khối món + khối attempt | 25.929.493 byte | 1.713.821 byte |
| Byte ghi trong prepare + commit, gồm bản trung gian | 667.041.541 byte | 36.969.896 byte |
| Tăng dung lượng blob vật lý ròng | +667.026.517 byte | −24.237.519 byte |
| Tăng dung lượng còn được manifest tham chiếu | Chưa đo chỉ số này ở baseline | **+2.235.217 byte** |
| Outcome client giả | `success` | `success` |

Nhật ký giảm khoảng 93,39%. Tổng dưới 60 giây, đọc đầu dưới 2 giây và tăng dữ liệu còn tham chiếu khoảng 2,24 MB/lượt đạt mục tiêu của phép đo này. **Chưa đạt `saveMs < 5 giây`**: vượt 526,96 ms. Trong 5.526,96 ms có 1.494,96 ms dọn, còn khoảng 4.032,00 ms ghi/serialize/khóa/fsync và công bố manifest. Không loại thời gian dọn ra khỏi số đo để nhận đạt.

Dung lượng vật lý ròng âm sau sửa là do dọn cả các blob trung gian được tạo khi dựng fixture; **không có nghĩa lượt mới không chiếm dung lượng**. Chỉ số +2.235.217 byte được tính theo tập hash còn tham chiếu trước/sau để tránh kết luận sai. Byte ghi 36,97 MB vẫn gồm các checkpoint và bản xác nhận trung gian, không phải dung lượng giữ lại cuối lượt.

Baseline được chạy **trước mọi thay đổi ứng dụng của TASK-126**. Bản trước đo nhánh bảng cũ không mốc, bản sau đo nhánh có mốc như mục tiêu spec; đây là so sánh toàn luồng, không phải phép tách riêng tác động của từng tối ưu. Bản cuối chốt tổng thời gian ngay khi commit xong; baseline ghi tổng sau đọc blob nhật ký để lấy kích thước nên có thêm chi phí đọc/parse thống kê. Không có số đo thống kê nhiều lần hay xác minh trên Kiot thật. Hai phép đo cuối có một khoảng chạy chồng nhau trong các khoảng chờ giả; không xem đây là benchmark máy độc chiếm tài nguyên.

Bằng chứng gốc:

- `tasks/TASK-126-benchmark-before.json` — kho tạm `C:\Users\Admin\AppData\Local\Temp\task126-before-F3lIQO`.
- `tasks/TASK-126-benchmark-after-final-measured.json` — kho tạm `C:\Users\Admin\AppData\Local\Temp\task126-after-final-measured-LZZhlX`.
- Các JSON `after`, `after-final`, `after-bounded`, `after-measured`, `after-published`, `after-compressed` là số đo các bước trung gian, **không** dùng thay bản cuối. Kho tạm được giữ lại.

Lệnh đã chạy lần lượt qua các bước sửa:

```powershell
node tasks/TASK-126-benchmark.mjs before
node tasks/TASK-126-benchmark.mjs after --trusted
node tasks/TASK-126-benchmark.mjs after-final --trusted
node tasks/TASK-126-benchmark.mjs after-bounded --trusted
node tasks/TASK-126-benchmark.mjs after-measured --trusted
node tasks/TASK-126-benchmark.mjs after-published --trusted
node tasks/TASK-126-benchmark.mjs after-compressed --trusted
node tasks/TASK-126-benchmark.mjs after-final-measured --trusted
```

Chạy lại script trên source hiện tại sẽ đo bản sau, kể cả khi đặt nhãn `before`; JSON baseline đã lưu mới là bằng chứng của bản trước.

## Test đã viết, chưa chạy

`Webstie/server/src/sale-ai/test/journal-storage.test.js`, 9 ca:

- Làm mới tự động không đổi sản phẩm nâng mốc bảng cũ, không sửa snapshot cũ.
- Bảng thiếu mốc rơi về `all()` kèm thông báo; tải lại cung cấp mốc.
- Cursor có margin và sửa tay bị chặn trước gửi.
- Nhật ký gọn 51 món (2 khối), mở kho lại: lịch sử, chọn lỗi, fingerprint TASK-125 và hoàn tác chỉ giá.
- Nhật ký JSON cũ: đọc nguyên dạng, lịch sử món lỗi, endpoint chọn lại lỗi, cập nhật lại món lỗi và hoàn tác món đã ghi.
- Cache bản công bố tái sử dụng sản phẩm không đổi, cách ly món vừa đổi.
- Bảng lớn nén/giải nén lossless, bảng cũ đọc được, blob sản phẩm vẫn JSON thường.
- Lỗi ghi blob hoặc manifest không cho phép PUT.
- Dọn sau lượt giữ 7 bảng, không còn orphan, khối con sai hash làm đọc/audit thất bại.

Các ca có sẵn cho 1.311 món, khóa/gián đoạn, PUT không rõ kết quả, TASK-125, E2E và BossTele được giữ nguyên. Không sửa/nới test hiện có. Theo phân công người dùng, **không chạy test suite/build**, nên không có bằng chứng red/green và không tuyên bố các test mới/cũ đạt. Outcome benchmark chỉ xác nhận lượt client giả tương ứng, không thay các bộ test.

## Kiểm tra đã chạy và giới hạn

- `node --check` cho 11 file: 8 lib thay đổi (`live`, `batch-joint`, `restore`, `split-store`, `store-cleanup`, `service`, `live-draft`, `journal-storage`) + `kiot-fingerprint`, test mới, script benchmark: exit 0. Test mới được kiểm cú pháp lại sau sửa cuối.
- `git diff --check -- <các file TASK-126>`: exit 0. Có cảnh báo Git LF sẽ đổi sang CRLF cho `restore.js`/`live-draft.js`; không phải lỗi whitespace hoặc lỗi test.
- Rà source độc lập bằng agent chỉ đọc theo skill `requesting-code-review`: chưa phát hiện lỗi mới có thể khẳng định ở chunk/hash/cleanup lock, cache publication, gzip và tương thích. Không phải review Claude, không chạy test.
- Rà source phát hiện giới hạn **có sẵn ngoài TASK-126**: `Simulator.recoverInterrupted` có thể chuyển platform `unchanged` sang `unknown` khi mở lại một lượt vẫn `running`. Giữ nguyên recovery theo phạm vi “Không đổi”; Claude cần lưu ý khi kiểm lại TASK-125/gián đoạn. Chưa tái hiện bằng test trong phiên này.
- Không có lệnh bị sandbox chặn; không xin approval. Một lần đọc nhầm `lib/notes.js` báo file không tồn tại; không tạo file đó. Lần đọc đầu không chỉ định UTF-8 hiển thị tiếng Việt sai, đã đọc lại đặc tả/tài liệu liên quan bằng UTF-8.
- Không gọi Kiot/Sapo thật, không đọc `.env` hoặc in khóa, không xoá dữ liệu thật, không dừng/khởi động lại server, không bật bot, không commit. Không yêu cầu máy chủ nạp lại code.
- Chưa xác minh trình duyệt, dữ liệu thật 139 MB, thời gian trên kho thật nhiều lịch sử, hoặc hiệu năng giải nén khi khởi động. Số đo kho mới tạm không chứng minh tốc độ trên kho thật đó.

## Lệnh bàn giao Claude

Tại `D:\Website_3Q\Webstie\server`, nhóm tập trung:

```powershell
node --test src/sale-ai/test/journal-storage.test.js src/sale-ai/test/split-store.test.js src/sale-ai/test/retention.test.js src/sale-ai/test/batch-speed.test.js src/sale-ai/test/batch-joint.test.js src/sale-ai/test/kiot-price-only.test.js src/sale-ai/test/background-update.test.js src/sale-ai/test/journal-window.test.js
```

Chạy đầy đủ theo spec:

- `D:\Website_3Q\Webstie`: `npm.cmd run build`, `npm.cmd test`.
- `D:\Website_3Q\Webstie\server\src\sale-ai\test`: `node --test *.test.js`.
- `D:\Website_3Q\Webstie\server`: đặt `$env:SALE_AI_E2E='1'`, chạy `npx.cmd vitest run src/tests/saleAiUpdateAll.test.ts` 5 lần, ghi từng kết quả.
- `D:\Website_3Q\Webstie\BossTele`: `npm.cmd test`.
- Đo lại offline nếu cần: `node tasks/TASK-126-benchmark.mjs claude --trusted` tại gốc repo. Không dùng lệnh thật hay kho thật để thay cho benchmark giả.

Chỉ chuyển `verified` khi có kiểm tra độc lập và đánh giá rõ phần `saveMs` chưa đạt.

## Sua theo review

- Máy: Laptop (DESKTOP-4G5GOSR). Ngày 02/11/2026; Codex xử lý toàn bộ nhóm finding trong `TASK-126-review.md`. Trạng thái: `ready_for_review`, chưa được Claude review lại; giới hạn hiệu năng và E2E bên dưới vẫn cần kiểm tra độc lập.

### Khởi tạo trên bản sao dữ liệu thật

- Trước sửa: `node tasks/TASK-126-store-integrity.mjs Webstie/server/data/sale-ai-backup-20261102-162108` tái hiện `LOAD ERROR Cleanup plan or manifest changed; audit again`.
- Nguyên nhân: `keptBytes += (await ...).bytes` đọc giá trị vế trái trước khi chờ I/O. Nhiều worker cộng vào cùng biến nên mất một số lần cộng; hai audit trên kho không đổi vẫn có `keptBytes` khác nhau. `lib/store-cleanup.js` nay chờ đọc vào biến cục bộ rồi cộng đồng bộ; giữ nguyên việc so sánh toàn bộ plan, khóa và kiểm hash.
- Sau sửa, cùng script trên **bản sao mới trong temp**: `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115`. Log: `TASK-126-review-integrity-final.log`. Client Kiot/Sapo trong script chặn mạng; startup không đọc Sapo. Chỉ in số lượng, không in sản phẩm/khóa. Dữ liệu thật bên dưới `server/data` chỉ được dùng làm nguồn sao chép backup này, không đọc trực tiếp để audit/dọn.

### Bảo toàn blob và lịch sử

- `lib/split-store.js`: khi lưu transaction/checkpoint (`immutable` hoặc `stableRuns`), manifest mới giữ `recoveryIndexes` của các checkpoint trước, công bố nguyên tử cùng chỉ mục hiện hành trước mọi sweep. Không có cửa sổ manifest cũ/có thể khôi phục trỏ tới blob vừa bị dọn.
- `lib/store-cleanup.js`: tập giữ blob là hợp của chỉ mục hiện hành và mọi `recoveryIndexes`, gồm descriptor nhật ký và các chunk con. Kiểm hash/kiểu của cả gốc phục hồi; tham chiếu hỏng thì dừng dọn. Các chỉ mục/descriptor trùng chỉ duyệt một lần trong một audit; bộ đếm `counts` vẫn mô tả trạng thái hiện hành.
- Lần lưu thông thường khi không còn transaction công bố manifest không còn những gốc đã hết vòng đời; sau công bố mới được dọn phần không còn tham chiếu. Startup audit vẫn giữ mọi gốc tồn tại trong manifest. Không tự chạy dọn trên kho thật.
- Cùng hash blob được nhiều worker ghi đồng thời nay dùng chung promise ghi (`pendingBlobs`), tránh tranh chấp rename trên Windows. Test bổ sung đã tái hiện lỗi rename khi nhiều nhật ký dùng chung chunk trước sửa, sau sửa xác nhận 16 yêu cầu cùng hash chỉ ghi một lần. Các worker vẫn được chờ hoàn tất khi lỗi; không công bố manifest trước fsync.
- Test cũ process-stop tại `journaled/ready/sending/verified/done` đạt và không PUT khi mở lại. Test mới còn giữ/đọc lại mọi manifest checkpoint của nhật ký compact sau các lần dọn, kiểm audit lặp/plan apply trên 7 bảng cũ+nén và nhật ký cũ+mới, bộ lọc đúng giá, tham chiếu phục hồi hỏng, và snapshot API với SplitStore thật.
- Sửa bất biến lịch sử và các finding TASK-125 tại `live.js`, `view-data.js`, `public/live-ui.js`; chi tiết và kiểm tra nằm trong mục cùng tên của `TASK-125-result.md`. Chỉ đổi regex lỗi được review cho phép, không nới các test khác.

### Bằng chứng kiểm tra và giới hạn

- Nhóm lỗi + vùng liên quan: **78/78 đạt** trong cùng tiến trình (`TASK-126-review-focused-final.log`); regression cuối **4/4 đạt**, storage/retention cuối **25/25 đạt**. Các lệnh đầy đủ được ghi trong `TASK-125-result.md` mục cùng tên; không coi `--test-isolation=none` là bằng chứng suite có subprocess/E2E đạt.
- Build server và frontend typecheck đạt. Build frontend, test website, test lõi theo lệnh chuẩn, BossTele theo lệnh chuẩn và E2E bị `spawn EPERM`. BossTele cùng tiến trình: 111/140 đạt, 29 ca vẫn bị chặn subprocess. Không xin approval. E2E chưa chạy ca nào; chưa có bằng chứng 5 lượt đạt. Log riêng `TASK-126-review-{build,server-build-final,frontend-typecheck,web-test,core-standard,bosstele,bosstele-inprocess,e2e}.log`.
- Toàn bộ lõi cùng tiến trình: **321/321 đạt, 0 lỗi/0 bỏ qua**, thời gian 406.694 ms (`TASK-126-review-core-final.log`). Đây không phải suite 409 ca có subprocess/isolation trong review: module fixture được nhập chung chỉ chạy một lần khi bỏ isolation. Shell trả exit 1 vì cảnh báo stderr trong ca cố tình gây lỗi dọn được PowerShell bọc thành `NativeCommandError`; kiểm tra riêng retention có mã thoát Node 0 khi thu `$LASTEXITCODE` tường minh (`TASK-126-review-retention-exit.log`). Không tuyên bố lệnh toàn bộ exit 0. Tối ưu cuối chỉ tránh duyệt lại index/descriptor trùng được kiểm bằng 25 ca storage/retention; lượt trung gian có lỗi đã sửa vẫn giữ log truy vết.
- Đo lại offline: `node tasks/TASK-126-benchmark.mjs review-final --trusted`, vẫn 4.800 sản phẩm/1.311 món/27 lô, PUT giả 700 ms và đọc thay đổi 400 ms, SplitStore thật trong temp. Tổng **57.469,61 ms**, đọc đầu **407 ms**, `saveMs` **18.763,95 ms** gồm dọn **8.607,00 ms**; 0 `all()`, 28 `listModified`, 27 PUT giả; outcome success. Nhật ký cuối **1.713.820 byte**, ghi tổng **37.112.474 byte**, tăng blob vật lý **10.481.539 byte**, tăng byte còn tham chiếu kể cả gốc phục hồi **36.954.275 byte**. Artifact: `TASK-126-benchmark-review-final.json`.
- **Chưa đạt mục tiêu save <5 giây và tăng kho chỉ vài MB/lượt.** Bảo toàn checkpoint giữ thêm blob tới lần lưu nghỉ checkpoint; không đánh đổi an toàn dữ liệu để làm số đo nhỏ. Hàm đo `reachableBytes` đã tính cả `recoveryIndexes`, tránh bỏ sót dung lượng còn cần phục hồi. Phép đo chạy cùng đợt test lớn, không phải benchmark độc chiếm máy. Lượt `review-fixed` trước đó có tổng 40.964 ms/save 7.712 ms nhưng hàm đếm tham chiếu lúc đó chưa tính gốc phục hồi; không dùng số tăng tham chiếu của lượt đó để kết luận dung lượng.
- Không gọi Kiot/Sapo thật, không in khóa, không stop/restart server, không bật bot, không commit. Working tree có sẵn nhiều thay đổi; không revert hoặc sửa ngoài phạm vi.
