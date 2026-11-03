Máy: Laptop (DESKTOP-4G5GOSR)

# TASK-134 — Header dùng lại logo gốc BAOQ Luxury

- Dự án: web.
- Người thực hiện: Codex; người kiểm tra độc lập: Claude.
- Trạng thái: `ready_for_review`.
- Hành động gần nhất: ngày 03/11/2026, triển khai theo đặc tả và chạy kiểm tra trong sandbox.
- Bước tiếp theo: Claude kiểm tra độc lập, chạy lại build/test và nghiệm thu giao diện desktop/mobile ngoài sandbox.

## Thay đổi

- `Webstie/frontend/src/app-header.tsx`: thay ảnh logo trong nút `.brand` bằng `<span className="wordmark"><img src="/brand/baoq-logo-original.jpg" alt="" width="2048" height="2048"/></span>`.
- `Webstie/frontend/src/main.tsx`: dùng cùng markup cho header trang chưa đăng nhập.
- Giữ nguyên `aria-label="BAOQ Luxury, Trang chủ"` và hai handler điều hướng hiện có.
- `Webstie/frontend/src/app-v2.css`: bỏ khối override `.brand`, `.wordmark-img` và media query tương ứng; thay comment theo đúng đặc tả. Dùng lại crop `.wordmark` sẵn có: desktop 166×22 px, dưới 700 px 128×17 px; padding `.brand` trở về CSS nền.
- Không sửa login, drawer, ảnh gốc/wordmark PNG, V2, shared, BossTele, services hoặc file test của TASK-133. Bảo toàn các thay đổi đã có trong hai file header; không commit, không chuyển nhánh, không thêm dependency.
- Báo cáo và bằng chứng mới: `tasks/TASK-134-result.md`, `tasks/TASK-134-build.log`, `tasks/TASK-134-test.log`.

## Kiểm tra thực tế

1. **Đạt — tiêu chí tìm kiếm:** `rg -n 'wordmark-img|baoq-wordmark' Webstie/frontend/src` trả exit 1, không có kết quả.
2. **Đạt — kiểm tra diff:** `git diff --check -- Webstie/frontend/src/app-header.tsx Webstie/frontend/src/main.tsx Webstie/frontend/src/app-v2.css` trả exit 0; chỉ có cảnh báo Git sẽ đổi LF sang CRLF.
3. **Blocked — build đầy đủ:** chạy `npm.cmd run build` tại `Webstie/`, exit 1. Build server (`tsc` và các script copy tài nguyên) và frontend `tsc --noEmit` đã qua; Vite không tải được config do esbuild không spawn được tiến trình (`Error: spawn EPERM`). Bằng chứng: [TASK-134-build.log](TASK-134-build.log).
4. **Blocked — test chung:** chạy `npm.cmd test` tại `Webstie/`, exit 1. Dừng ngay tại shared `node --test test/*.test.js`: cả 7 file đều lỗi `spawn EPERM` trước khi chạy các ca kiểm thử. Các file: `catalog-fetcher.test.js`, `connection-config.test.js`, `money.test.js`, `product-search-detail.test.js`, `product-search.test.js`, `target-price.test.js`, `text.test.js`. Frontend, server và Sale AI chưa được chạy bởi chuỗi lệnh này. Bằng chứng: [TASK-134-test.log](TASK-134-test.log). Không sửa test hay file thuộc TASK-131 để né lỗi môi trường.
5. **Blocked — tiêu chí 2, trình duyệt:** thử `chromium.launch({headless:true})` bằng Playwright đã cài trong frontend; exit 1, báo thiếu executable `C:\Users\Admin\AppData\Local\ms-playwright\chromium_headless_shell-1248\chrome-headless-shell-win64\chrome-headless-shell.exe`. Không cài thêm browser hoặc xin quyền. Chưa có ảnh chụp hay bằng chứng render thực tế; chưa xác minh màu đồng, không dòng phụ, nền không lệch màu/viền, crop không mất chữ và thao tác bấm logo trên desktop/mobile, cả trước/sau đăng nhập. Claude cần kiểm tra các mục này trên trình duyệt chạy được.

## Giới hạn bàn giao

Thay đổi code đã hoàn tất theo phạm vi đặc tả; chưa được Claude kiểm tra độc lập, chưa đủ bằng chứng nghiệm thu giao diện hoặc build/test đầy đủ. Không dùng kiểm tra tĩnh thay cho nghiệm thu trình duyệt. Chỉ thay markup/CSS hiện có, không thêm logic hay sửa test.
