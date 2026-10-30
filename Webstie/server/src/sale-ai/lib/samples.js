// Screenshot values are transcribed; type is derived from names, floors remain unconfirmed.
const screenshot = [
  ['SP000395', 'Hoodie DG', 4000000, 1, '2023-12-20T23:42'],
  ['SP000393', 'slp vinh', 25000000, 0, '2023-12-20T23:08'],
  ['SP000378', 'Váy gc', 12000000, 1, '2023-12-20T22:52'],
  ['SP000371', 'Quần Ess Vinh', 2000000, 1, '2023-12-20T22:41']
].map(([code, name, currentPrice, stock, createdAt]) => ({ code, name, currentPrice, stock, createdAt,
  active: true, type: null, floor: null, notes: '', source: 'Từ ảnh — bản sao mẫu' }));
const synthetic = [
  ['TEST-15', 'Túi giả định 15 triệu', 15000000, 'normal', null, '2026-10-16'],
  ['TEST-HOT', 'Đồng hồ giả định hottrend 90 triệu !', 90000000, 'hottrend', null, '2026-10-16'],
  ['TEST-101', 'Mẫu giả định khóa nhóm 101 triệu', 101000000, 'normal', 80000000, '2026-07-01'],
  ['TEST-NEW', 'Mẫu giả định tạo sau mốc chung', 35000000, 'normal', null, '2026-08-10'],
  ['TEST-600', 'Mẫu giả định cần duyệt riêng', 600000000, 'normal', null, '2026-07-01'],
  ['TEST-MISSING', 'Mẫu giả định thiếu ngày', 9000000, 'normal', null, null]
].map(([code, name, currentPrice, type, floor, createdAt]) => ({ code, name, currentPrice, type, floor, createdAt,
  stock: 1, active: true, source: 'Giả định kiểm thử', notes: 'Ghi chú gốc của mẫu; cần được giữ nguyên.' }));
export class SampleSource {
  revision = '2026-10-29-jul-batch-v9';
  async load() { return structuredClone([...screenshot, ...synthetic, ...hottrendScreenshot]); }
}
const hottrendScreenshot = [
  ['SP024540', 'Dây chuyền Dior My Dior Vàng trắng Kim cương FS2026 NEW 6/10/2026 !', 105000000, '2026-10-07T13:42'],
  ['SP024493', 'CỌC Dây chuyền VCA Sweet Alhambra Vàng hồng Carnelian Đỏ Bill Certi 2023 5/10/2026 ! - Spa XT', 42000000, '2026-10-06T12:13'],
  ['SP024492', 'Túi Louis Vuitton CarryAll Vibe BB Đen SHW 5/10/2026 ! - Spa XT', 69500000, '2026-10-06T12:13'],
  ['SP024479', 'PEND Túi Bottega Veneta Andiamo Small Intrecciato Nappa Xám Silica GHW KG ! - Spa XT', 73000000, '2026-10-05T16:33'],
  ['SP024434', 'Túi LV Alma BB Monogram Canvas Nâu GHW FS8/26 KG.- !', 36500000, '2026-10-03T14:28'],
  ['SP024431', 'Vòng Cartier Love Small Model sz16 YG Certi 2023 3/10/2026 !', 96000000, '2026-10-03T14:28'],
  ['SP024404', 'Bông tai Van Cleef & Arpels Sweet Alhambra Onyx Vàng vàng Box Certi 30/9/2026-. !', 58000000, '2026-10-01T17:40'],
  ['SP024403', 'CỌC Dây chuyền Van Cleef & Arpels Vintage Alhambra Guilloché Vàng trắng Fullset Bill Certi 30/9/2026 !-.', 100000000, '2026-10-01T17:39']
].map(([code, name, currentPrice, createdAt]) => ({ code, name, currentPrice, createdAt,
  stock: 1, active: true, floor: null, notes: '', source: 'Từ ảnh hottrend — bản sao mẫu' }));
