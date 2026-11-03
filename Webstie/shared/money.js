'use strict';

const vnd = value => `${Math.round(value).toLocaleString('vi-VN')}đ`;
const tr = value => `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr`;

module.exports = { vnd, tr };
