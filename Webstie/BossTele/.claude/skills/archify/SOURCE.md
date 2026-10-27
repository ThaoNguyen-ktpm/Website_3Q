# Nguồn skill archify

- Repo: https://github.com/tt-a1i/archify (thư mục `archify`), giấy phép MIT (LICENSE đi kèm), bản 3.1.0.
- Commit ghim: `c90188ea047466ed3f359b9420a3056194321a4b`
- Tải ngày 2026-10-16 theo yêu cầu của Bảo — bản GỌN: bỏ `examples/*.html` (~12 MB ảnh render mẫu), giữ code, schema, JSON mẫu.
- CẢNH BÁO: skill chạy code Node (`bin/archify.mjs` …) mà Claude CHƯA đọc toàn bộ (≈4,6 MB). Claude chỉ quét: không thấy lệnh gọi mạng trực tiếp; có dùng `child_process` (mở file kết quả, gọi `git` đọc repo). Bảo đã chấp nhận rủi ro này.
- BẮT BUỘC khi chạy: đặt `ARCHIFY_UPDATE_CHECK_DISABLED=1` để tắt kiểm tra cập nhật qua mạng (ví dụ PowerShell: `$env:ARCHIFY_UPDATE_CHECK_DISABLED="1"; node bin/archify.mjs ...`).
- Không chạy `npm install`/`npm run` trong thư mục này khi chưa được Bảo duyệt.
