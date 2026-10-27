# TASK-001 — Review độc lập

- **Người phụ trách:** Claude
- **Kết luận:** `verified`

## Phạm vi đã xem
`CLAUDE.md`, `AGENTS.md`, `tasks/TASK-001-spec.md`, `tasks/TASK-001-result.md`, `add.js`, `test/add.test.js`, `tasks/TASK-001-tests.txt`. Tôi kiểm tra code thực tế theo AC-1 đến AC-9 và không dựa vào báo cáo của Codex làm bằng chứng.

## Bằng chứng (tôi đã tự chạy qua Bash)

| Lệnh | Kết quả thực tế |
|---|---|
| `node --version` | `v24.21.0` |
| `node --test` | `tests 30`, `pass 30`, `fail 0`. Tool không báo lỗi nên mã thoát là 0 |
| `node add.js 2 3` | stdout `5`, mã thoát 0 |
| `node add.js abc xyz` | stderr `Error: invalid number: "abc"`, mã thoát 1 |
| `node add.js 1 2 3` | stderr `Error: expected exactly 2 numbers, got 3` + `Usage: node add.js <a> <b>`, mã thoát 2 |
| `node add.js 1e308 1e308` | stderr `Error: result overflow`, mã thoát 1 |
| `ls -a D:/BossTele D:/BossTele/test` | Chỉ có `AGENTS.md`, `CLAUDE.md`, `add.js`, `tasks/`, `test/add.test.js`. Không có `node_modules` hay `package.json` |

Lần chạy `node --test` của tôi cho cùng 30 tên test và cùng kết quả pass với `tasks/TASK-001-tests.txt`. Tôi chỉ so với file log này, không dùng nó làm bằng chứng.

## Đối chiếu tiêu chí nghiệm thu
- **AC-1, AC-2, AC-7:** Đạt. Code ở `add.js:21-29`; test CLI ở `test/add.test.js:28-34`, có cả biên `1.7976931348623157e308`.
- **AC-3:** Đạt. `add.js:23-26` trả mã thoát 2 và in đúng hai dòng stderr; test ở `test/add.test.js:36-40` (0, 1, 3 đối số).
- **AC-4:** Đạt. Regex ở `add.js:3` khớp đúng đặc tả. `add.js:6` kiểm tra thêm `Number.isFinite`, nên `1e400` bị xếp vào đầu vào không hợp lệ. Test ở `test/add.test.js:42-49` dùng đủ các ví dụ không hợp lệ của mục 4.2 (và thêm vài trường hợp) ở cả vị trí `a` lẫn `b`.
- **AC-5:** Đạt. `add.js:29` parse `a` trước `b`; test ở `test/add.test.js:51-53`.
- **AC-6:** Đạt. `add.js:17`; test ở `test/add.test.js:55-59`.
- **AC-8:** Đạt. Có test gọi hàm trực tiếp (`test/add.test.js:19-26`) và test CLI bằng `spawnSync(process.execPath, …)` (`test/add.test.js:10-17`).
- **AC-9:** Đạt. Không có dependency. Code chỉ dùng `process.argv`, `console.log`/`console.error` và `process.exitCode`, không có `process.exit()`.

## Phát hiện
Không có lỗi chặn nghiệm thu. Chỉ có vài ghi chú nhỏ, không bắt buộc sửa:
1. **Thấp:** `add.js:6`: điều kiện `value.trim() !== value` là thừa, vì regex với `^…$` (không có cờ `m`) đã loại khoảng trắng và ký tự xuống dòng. Điều kiện này vô hại.
2. **Thấp, về tài liệu:** `tasks/TASK-001-spec.md:10` ghi câu tiếng Anh là "Yêu cầu trực tiếp của người dùng". Nhưng `tasks/TASK-001-result.md:21` cho biết đó là prompt Codex gửi Claude, không phải lời người dùng. Nên sửa nguồn trong đặc tả cho đúng.

## Giới hạn
- Tôi chỉ kiểm tra cục bộ trên Windows với Node v24.21.0. Chưa kiểm tra trên Node 18 hoặc 20.
- Tôi chỉ chạy tay một số lệnh CLI tiêu biểu. Các trường hợp còn lại được xác minh qua bộ test tôi đã tự chạy.
- AC-9 phần "không truy cập mạng, không đọc/ghi file" được xác minh bằng cách đọc code, không dùng công cụ giám sát tiến trình.

## Kết luận
**`verified`**: tôi đã kiểm chứng AC-1 đến AC-9 bằng cách đọc code và tự chạy `node --test` cùng các lệnh CLI.