Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-135 — Review

- Dự án: web
- Người review: Claude · Ngày: 03/11/2026
- Trạng thái: `changes_requested`. Hướng của đặc tả bị thay bằng TASK-136.

## Bằng chứng (Claude tự chạy)
- `npx playwright test -c task041.config.ts`: 18 đạt, 2 hỏng.
  - "V2 short lists fill the frame…": phần khung chi tiết và lớp mờ đạt ở 1440, 1024 và 390. Hỏng ở dòng 268: tại 390×844 trang Thu–bán, trang ngoài vẫn cuộn dư.
  - "V2 embeds… survives reload and history": hỏng ở dòng 217. Đang ở `#page=v2-tx`, F5 rồi Back vẫn ở `#page=v2-tx`. Lặp lại cả 3 lần chạy.
- `npm run build` và `npm test` tại `Webstie`: exit 0.

## Phát hiện
- Cao: hướng triển khai (iframe cao một màn hình, cuộn bên trong) không đúng ý Bảo. Ảnh của Bảo lúc 13:42 cho thấy V2 bị nhốt trong ô và biểu đồ bị cắt. Bảo muốn như V2 mở trực tiếp: trang cuộn chung, khung chi tiết phủ cả cửa sổ. Lỗi do Claude viết đặc tả TASK-135 sai ý, không phải lỗi triển khai.
- Trung bình: hai test hỏng nêu trên.

## Kết luận
Không nghiệm thu. Thay bằng TASK-136, gồm cả sửa lỗi lịch sử.
