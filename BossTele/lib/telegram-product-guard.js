'use strict';

const { parseCommand, REJECT } = require('./chat-commands');

// Bảo 2026-10-19 (TASK-029): free-form questions about BaoQ products/price/stock/business go to Claude too.
// Accented words that fold into common non-store words ("bán"/"bạn", "giá"/"gia đình") are matched with accents only.
const accented = /(?:^|[^\p{L}])(giá|bán|hàng|tồn|lời|lãi|vốn|chốt|túi|đồng hồ|kho|khách|mẫu|sỉ|lẻ|hãng|sàn)(?=$|[^\p{L}])/u;
const folded = /\b(san pham|sku|sp\d{3,}|tui xach|gia ban|gia von|gia chot|ton kho|con hang|het hang|hot trend|thi truong|gia ngoai|gia tham khao|tham khao gia|resale|shop|hang hieu|do hieu|secondhand|second hand|2hand|ky gui|authentic|doanh thu|loi nhuan|khach hang|don hang|kiot ?viet|sapo|bao ?q|baoq luxury|chanel|hermes|louis vuitton|lv|gucci|dior|prada|ysl|saint laurent|celine|fendi|balenciaga|bottega|goyard|burberry|givenchy|loewe|rolex|cartier|valentino|versace|miu miu|coach|mcm|chloe)\b/;
const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

function storeQuestion(text) {
  // Line breaks are normal when a product card is pasted back; other control characters stay blocked.
  const value = String(text ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  // Same limits as commands: one sentence, no control characters, at most 500 characters.
  if (!value || value.length > 500 || /[;\p{Cc}]/u.test(value)) return false;
  return accented.test(value.normalize('NFC').toLowerCase()) || folded.test(fold(value));
}

async function allowProductMessage(ctx, text, hasAttachment = false) {
  if (!hasAttachment && (parseCommand(text) || storeQuestion(text))) return true;
  await ctx.reply(`${REJECT}\nVí dụ: tìm tên "Chanel", tìm sku SP022466 hoặc hỏi "túi Chanel nào đang bán chạy?"`);
  return false;
}

module.exports = { allowProductMessage, storeQuestion };

