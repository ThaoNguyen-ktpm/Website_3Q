Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-125 + TASK-126 — Review của Claude

- Kết luận: **`changes_requested`** (cả TASK-125 và TASK-126)
- Ngày: 02/11/2026 ~16:30
- Phạm vi:
  - spec và result của TASK-125, TASK-126; diff `lib/store-cleanup.js`, `lib/split-store.js`, `lib/journal-storage.js`;
  - chạy lại toàn bộ kiểm tra;
  - kiểm tra kho thật chỉ đọc, và nạp thử trên bản chép.

## Bằng chứng

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt |
| `npm test` (Webstie) | **lỗi** ở `test:sale-ai` |
| `node --test` lõi Sale AI | **399/409**, lỗi 10 |
| E2E `saleAiUpdateAll.test.ts` ×5 | **17/18 cả 5 lần**: ca TASK-125 lỗi |
| BossTele `npm test` | 140/140 |
| Nạp bản chép sạch của dữ liệu thật (`server/data/sale-ai-backup-20261102-162108`) bằng `createSaleAi` (script `store-integrity.mjs`, không mạng) | **`LOAD ERROR Cleanup plan or manifest changed; audit again`** |

Kho thật lúc 16:25 vẫn đủ tham chiếu (`kiot-state.store` 4.476 sản phẩm / 7 runs / 16 updates, `sapo-state.store` 6.097, không thiếu file). Claude đã sao lưu `server/data/sale-ai-backup-20261102-161944` (chép trúng lúc máy chủ đang dọn `sapo-state.store`, không nhất quán) và `…-162108` (sạch).

## Lỗi

### Nghiêm trọng 1: Sale AI không khởi tạo được trên dữ liệu thật sau khi khởi động lại

- Nạp bản chép sạch của kho thật bằng code hiện tại ném `Cleanup plan or manifest changed; audit again` (`lib/store-cleanup.js:78`, `applyPlan`).
- Máy chủ thật đang chạy code này (PID 21168, khởi động 16:06). Lần khởi động lại kế tiếp nhiều khả năng sẽ báo "Sale AI tạm thời không khả dụng" mãi.
- Cần: tìm vì sao kết quả `audit` lần hai khác lần một trên cùng kho không đổi (thứ tự, tính không xác định, journal chunk, nén `runs`…). Thêm test nạp một kho có cấu trúc giống kho thật: nhiều lượt cũ, định dạng cũ lẫn mới.

### Nghiêm trọng 2: dọn kho xoá blob còn cần cho phục hồi

- `test/split-store.test.js:79` "process-stop snapshots around checkpoints restore unknown without repeating any PUT": `ENOENT … journaled\state.store\blobs\84dcfd…json`.
- Bước dọn ngay sau lưu (`cleanupLocked`) xoá blob mà ảnh chụp lúc tiến trình dừng giữa chừng vẫn trỏ tới. Đây là nguy cơ mất dữ liệu khi máy chủ chết giữa lượt, đúng tình huống TASK-121.
- Không được nới test. Phải bảo đảm: tại mọi thời điểm, manifest trên đĩa (và mọi trạng thái phục hồi có thể đọc) chỉ trỏ tới blob còn tồn tại.
- Cân nhắc chỉ dọn ở lúc khởi động hoặc theo lịch, khi không có lượt chạy, thay cho dọn sau mỗi lần lưu.

### Cao: món đã đúng giá vẫn bị gửi ở chế độ lô

`test/kiot-price-only.test.js:118` "already correct prices mixed with pending prices are not sent (batch=true)": mong đợi 0, nhận 1.

### Cao: E2E TASK-125

`saleAiUpdateAll.test.ts:144` "verified writes refresh the table and repeated background selection skips without PUT or retry": `expect(row.notesBefore)…` nhận `undefined`. Dòng bảng sau khi ghi không được làm mới đủ trường (yêu cầu 1 của TASK-125).

### Trung bình

- `test/kiot-price-only.test.js:135`: nhãn nút mong đợi "Cập nhật giá Kiot (1 món)", nhận `undefined`.
- `test/history-details.test.js:39`: không có tab / nhãn "Đã đúng giá" như test yêu cầu. Hộp chi tiết chỉ có dòng tóm tắt "1 đã đúng giá" và vẫn có tab "Bỏ qua (Sapo giá 0)".
- `test/split-store.test.js:61` "one-product live draft and checkpoints keep immutable history…": bảng `runs` bị thay bằng bản mới (`id` khác, `dataRevision` 2), sai tính bất biến của lịch sử. Liên quan cách TASK-126 nâng mốc bảng.
- `test/joint-update.test.js:61` (lặp 5 lần): câu lỗi mới "Kiot đã thay đổi (giá; giá Kiot hiện …, dự kiến …)" không khớp regex cũ `/Kiot đã thay đổi \(giá\); bấm Tải lại từ Kiot/`. TASK-125 yêu cầu câu rõ hơn, nên được phép sửa kỳ vọng, nhưng vẫn phải kiểm "Kiot đã thay đổi", lý do "giá" và "bấm Tải lại từ Kiot".

## Yêu cầu khi sửa

- Không nới test để ép đạt, trừ regex câu lỗi nêu trên.
- Không chạy dọn kho, không đọc hay xoá dữ liệu thật dưới `server/data/`. Thử trên bản chép, ví dụ chép `sale-ai-backup-20261102-162108` sang thư mục tạm.
- Kết quả phải gồm: nạp bản chép dữ liệu thật thành công, không còn lỗi Nghiêm trọng 1.


## Kiểm tra lại sau sửa (03/11/2026)

- Kết luận mới: **`verified`**.
- Nghiêm trọng 1: nguyên nhân là `keptBytes += await …` bị nhiều worker cộng đè nhau, nên hai lần audit ra kết quả khác nhau. Đã sửa; bản chép dữ liệu thật nạp được.
- Nghiêm trọng 2: manifest giữ `recoveryIndexes` của các checkpoint trước, và sweep chỉ chạy sau khi đã công bố. Test `split-store.test.js:79` đạt.
- Các lỗi Cao/Trung bình còn lại đã đạt test.
- Chưa đo lại trên Kiot thật. Lượt thật đầu tiên sau TASK-126 cần xem `BAOQ timings` (`initialReadMs`, `saveMs`).

## Bằng chứng (Claude chạy lại, 03/11/2026 ~10:00, sau mọi sửa của TASK-119…126)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (Webstie) | đạt |
| `npm test` (Webstie) | 465 đạt, 18 bỏ qua (18 ca E2E chỉ chạy khi `SALE_AI_E2E=1`) |
| `node --test` lõi Sale AI | 413/413 |
| `SALE_AI_E2E=1 npx vitest run src/tests/saleAiUpdateAll.test.ts` ×5 | 18/18 cả 5 lần |
| BossTele `npm test` | 140/140 |
| Nạp bản chép dữ liệu thật hiện hành bằng `createSaleAi`, không mạng (`tasks/TASK-126-store-integrity.mjs`) | `LOAD OK products 4476 updates 16 items 7288 runs 7 rows 11115` |
