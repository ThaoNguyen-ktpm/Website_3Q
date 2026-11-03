Máy: Laptop (DESKTOP-4G5GOSR)

# Kế hoạch sửa TASK-125/126 theo review

- [x] Đọc AGENTS, spec, result và review; giữ nguyên thay đổi có sẵn.
- [x] Tái hiện khởi tạo trên bản chép backup vào temp, mạng bị chặn; tái hiện các test lỗi trong cùng tiến trình khi sandbox chặn subprocess.
- [x] Sửa `store-cleanup.js`: cộng byte xác định, kiểm đủ gốc tham chiếu checkpoint. Sửa `split-store.js`: công bố gốc checkpoint cùng manifest trước dọn; test audit lặp, plan/apply, dữ liệu cũ/mới và phục hồi.
- [x] Sửa `live.js`, `view-data.js`, `live-ui.js`: giữ snapshot lịch sử luồng cũ, chốt issueCount sau summarize, trả snapshot qua API, nhãn nút và tab đúng giá. Chỉ đổi regex lỗi được cho phép; các test cũ khác giữ nguyên.
- [x] Chạy nhóm lỗi, toàn bộ lõi, build/test website, E2E và BossTele nếu sandbox cho phép. Ghi chính xác giới hạn và kết quả vào mục `Sua theo review` trong hai result.

Giới hạn xuyên suốt: không mạng Kiot/Sapo, không đọc dữ liệu thật ngoài sao chép backup được chỉ định sang temp, không restart/stop server, không dependency mới, không commit, không xin approval.
