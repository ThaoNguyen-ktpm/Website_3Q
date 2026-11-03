'use strict';

const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

module.exports = { fold };
