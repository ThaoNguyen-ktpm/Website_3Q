# TASK-001 — Đặc tả: CLI Node.js cộng hai số hữu hạn

| Trường | Giá trị |
|---|---|
| Mã công việc | TASK-001 |
| Người phụ trách | Claude (đặc tả) → Codex (triển khai) |
| Trạng thái | `ready` |
| Hành động gần nhất | Claude lập đặc tả theo yêu cầu demo đã được người dùng cho phép |
| Bước tiếp theo | Codex triển khai, ghi `tasks/TASK-001-result.md`, chuyển `ready_for_review` |
| Bằng chứng | Người dùng yêu cầu một demo nhỏ để xem quy trình hoạt động. Codex chọn ví dụ CLI cộng hai số và gửi prompt cho Claude lập đặc tả. |

## 1. Mục tiêu

Tạo một CLI Node.js nhỏ, nhận **đúng hai** đối số dòng lệnh. Mỗi đối số phải là một số thập phân hữu hạn. CLI in tổng của hai số ra stdout. Mọi trường hợp lỗi đều có thông báo và mã thoát xác định.

## 2. Phạm vi

- Một file CLI: `add.js` ở thư mục gốc `D:\BossTele`.
- Một file kiểm thử: `test/add.test.js`, dùng module có sẵn `node:test` và `node:assert`.
- Xử lý ba nhóm lỗi: thiếu hoặc thừa đối số, đầu vào không hợp lệ, tràn số.

## 3. Ngoài phạm vi

- Không dùng dependency nào: không `npm install`, không thư viện ngoài. `package.json` là không bắt buộc; nếu có thì không được khai báo dependency.
- Không đọc stdin, file, biến môi trường hay mạng. Không ghi file. Không có tác động nào ra ngoài tiến trình.
- Không làm tròn và không định dạng số thập phân. Không hỗ trợ BigInt, hệ hex/octal/binary, dấu phân cách hàng nghìn, `Infinity` hoặc `NaN`.
- Không xử lý mất độ chính xác của IEEE 754, ví dụ số nguyên lớn hơn `Number.MAX_SAFE_INTEGER`, hay kết quả `0.1 + 0.2`.
- Không có chức năng Telegram hay bất kỳ tính năng nào khác của BossTele.

## 4. Yêu cầu

### 4.1 Cách gọi

```
node add.js <a> <b>
```

Môi trường: Node.js ≥ 18 *(giả định: cần để có `node:test`)*.

### 4.2 Định nghĩa đầu vào hợp lệ

Một đối số hợp lệ khi thỏa **cả hai** điều kiện:

1. Toàn bộ chuỗi khớp biểu thức chính quy sau (không có khoảng trắng ở đầu hoặc cuối):
   ```
   ^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$
   ```
2. `Number(arg)` trả về giá trị mà `Number.isFinite(...)` đánh giá là `true`.

Chỉ dùng `Number()` hay `parseFloat()` là **không đủ**. `Number("")` trả về `0`, `Number(" 1 ")` trả về `1`, `Number("0x10")` trả về `16`, còn `parseFloat("1abc")` trả về `1`. Vì vậy bắt buộc phải kiểm tra bằng regex trước.

Ví dụ hợp lệ: `1`, `-5`, `+3`, `2.5`, `.5`, `5.`, `1e3`, `-1.2E-4`, `0`, `-0`.

Ví dụ **không hợp lệ**: `""`, `" 1"`, `abc`, `1abc`, `0x10`, `1_000`, `1,5`, `Infinity`, `NaN`, `--1`, `1e`, `.`, `1e400`.

*Quyết định:* `1e400` khớp regex nhưng `Number()` trả về `Infinity`. Trường hợp này được xếp vào **đầu vào không hợp lệ**, không xếp vào tràn số.

### 4.3 Thứ tự kiểm tra

1. Số lượng đối số (`process.argv.slice(2).length`) phải bằng đúng 2.
2. Kiểm tra `a`, sau đó kiểm tra `b`. Chỉ báo lỗi cho đối số không hợp lệ **đầu tiên**.
3. Tính `a + b`. Nếu kết quả không hữu hạn thì báo tràn số.

### 4.4 Đầu ra và mã thoát

Thông báo lỗi viết bằng tiếng Anh, chỉ dùng ký tự ASCII, để tránh lỗi mã hóa trên console Windows *(giả định)*.

| Trường hợp | stdout | stderr | Mã thoát |
|---|---|---|---|
| Thành công | `String(a + b)` + `\n` | (trống) | `0` |
| Sai số lượng đối số (0, 1, hoặc ≥ 3) | (trống) | `Error: expected exactly 2 numbers, got <N>` + `\n` + `Usage: node add.js <a> <b>` + `\n` | `2` |
| Đầu vào không hợp lệ | (trống) | `Error: invalid number: "<arg>"` + `\n` | `1` |
| Tràn số (tổng là `±Infinity`) | (trống) | `Error: result overflow` + `\n` | `1` |

Ghi chú:

- `<N>` là số đối số thực tế nhận được. `<arg>` là chuỗi gốc, giữ nguyên, không trim.
- Kết quả in bằng `String()`, nên `1e21` hiển thị là `1e+21`, `-0 + -0` hiển thị là `0`, `0.1 + 0.2` hiển thị là `0.30000000000000004`. Đây là hành vi được chấp nhận.
- Đặt mã thoát bằng `process.exitCode`, không dùng `process.exit()` đột ngột, để stdout/stderr được ghi hết.

### 4.5 Ràng buộc mã nguồn

- Tách logic thuần thành hàm dễ kiểm thử, ví dụ `parseFiniteNumber(str)` và `add(a, b)`. Chỉ chạy CLI khi file được gọi trực tiếp (`require.main === module`). Export các hàm qua `module.exports` (CommonJS).
- Không có dependency, không có I/O nào ngoài `process.argv`, stdout, stderr và mã thoát.

## 5. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| AC-1 | `node add.js 2 3` in `5`, mã thoát `0`, stderr trống. |
| AC-2 | `node add.js -1.5 0.5` in `-1`. `node add.js 1e3 .5` in `1000.5`. `node add.js +3 -0` in `3`. |
| AC-3 | Không có đối số, 1 đối số, hoặc 3 đối số: stdout trống, stderr đúng hai dòng của mục 4.4 với `<N>` chính xác, mã thoát `2`. |
| AC-4 | Mỗi ví dụ không hợp lệ ở mục 4.2, dù đặt ở vị trí `a` hay `b`: stdout trống, stderr `Error: invalid number: "<arg>"`, mã thoát `1`. |
| AC-5 | Khi cả hai đối số đều không hợp lệ (ví dụ `abc xyz`), chỉ báo lỗi cho `abc`. |
| AC-6 | `node add.js 1e308 1e308` và `node add.js -1e308 -1e308`: stdout trống, stderr `Error: result overflow`, mã thoát `1`. |
| AC-7 | `node add.js 1.7976931348623157e308 0` in `1.7976931348623157e+308`, mã thoát `0` (biên không tràn). |
| AC-8 | `node --test` chạy thành công. Bộ kiểm thử bao phủ AC-1 đến AC-7: kiểm thử hàm trực tiếp, và kiểm thử CLI bằng `child_process.spawnSync(process.execPath, [...])` để kiểm tra stdout, stderr và mã thoát. |
| AC-9 | Không có `node_modules`, không có dependency trong `package.json` (nếu file này tồn tại), không đọc hoặc ghi file, không truy cập mạng. |

## 6. Lệnh ví dụ (PowerShell)

```powershell
cd D:\BossTele

node add.js 2 3            # 5            ; $LASTEXITCODE = 0
node add.js -1.5 0.5       # -1           ; 0
node add.js 1e3 .5         # 1000.5       ; 0
node add.js 0.1 0.2        # 0.30000000000000004 ; 0
node add.js 5              # stderr: Error: expected exactly 2 numbers, got 1 ; 2
node add.js 1 2 3          # stderr: Error: expected exactly 2 numbers, got 3 ; 2
node add.js 1 abc          # stderr: Error: invalid number: "abc" ; 1
node add.js 0x10 1         # stderr: Error: invalid number: "0x10" ; 1
node add.js 1e400 1        # stderr: Error: invalid number: "1e400" ; 1
node add.js 1e308 1e308    # stderr: Error: result overflow ; 1

echo $LASTEXITCODE
node --test
```

Lưu ý: Windows PowerShell 5.1 không truyền đối số chuỗi rỗng (`""`) cho chương trình native. Vì vậy trường hợp `""` và `" 1"` phải được kiểm tra bằng `spawnSync` trong `test/add.test.js`, không kiểm tra thủ công qua PowerShell.

## 7. Kế hoạch triển khai (Codex)

1. Tạo `add.js` gồm `parseFiniteNumber`, `add`, phần chạy CLI và export.
2. Tạo `test/add.test.js` bao phủ AC-1 đến AC-7.
3. Chạy `node --test` và các lệnh ở mục 6. Ghi `tasks/TASK-001-result.md` gồm phiên bản Node, lệnh đã chạy và kết quả thực tế, rồi chuyển trạng thái `ready_for_review`.
4. Claude review độc lập và ghi kết quả vào `tasks/TASK-001-review.md`.

## 8. Giả định và điểm còn cần quyết định

Các mục dưới đây là giả định của Claude, **không phải** yêu cầu gốc của người dùng. Chúng không chặn việc triển khai, và người dùng có thể thay đổi:

- Tên file `add.js` và vị trí ở thư mục gốc.
- Mã thoát `2` cho lỗi sai cách dùng, `1` cho lỗi đầu vào và tràn số.
- Thông báo lỗi bằng tiếng Anh, chỉ dùng ký tự ASCII.
- Xếp `1e400` vào đầu vào không hợp lệ thay vì tràn số.
- Phiên bản tối thiểu Node.js ≥ 18, dùng CommonJS.
