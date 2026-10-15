'use strict';

const { parseCommand, REJECT } = require('./chat-commands');

async function allowProductMessage(ctx, text, hasAttachment = false) {
  if (!hasAttachment && parseCommand(text)) return true;
  await ctx.reply(`${REJECT}\nVí dụ: tìm tên "Chanel" hoặc tìm sku SP022466`);
  return false;
}

module.exports = { allowProductMessage };
