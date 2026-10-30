// Use the already-normalized Vietnam date; never infer a missing Kiot date.
export function ageCell(row, esc) {
  const date = row.createdDateVN;
  const valid = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
  const created = valid ? date.split('-').reverse().join('/') : 'Chưa xác định';
  const age = row.age == null ? '—' : `${esc(row.age)} ngày`;
  const m = row.m == null ? '—' : `M${esc(row.m)}`;
  return `${age}<br>${m}<span class="small">Tạo: ${esc(created)}</span>`;
}
