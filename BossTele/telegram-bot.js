'use strict';

// Bảo 2026-10-19 (TASK-030): BossTele's own Telegram bot. Claude Code channels are not enabled for this account,
// so the bot answers commands itself and sends free-form BaoQ questions to `claude -p` (Bảo's own plan, personal use).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createChatSession } = require('./lib/chat-session');
const { createProductSearch, createCatalogFetcher } = require('./lib/product-search');
const { stockGaps, stockGapText } = require('./lib/stock-gap');
const { loadConnectionConfig } = require('./lib/connection-config');
const { parseCommand, REJECT } = require('./lib/chat-commands');
const { storeQuestion } = require('./lib/telegram-product-guard');
const { render } = require('./chat');
const { createSalePricer } = require('./sale-price');
const { createMemory } = require('./lib/boss-memory');
const { createPriceFeedback } = require('./lib/price-feedback');
const { createAccess } = require('./lib/telegram-access');
const { draftRequest, withoutSources } = require('./lib/listing-draft');
const { withBuyPrice, withLotPrices } = require('./lib/buy-price');
const { marketIntent, marketPrompt, splitReply, exchangeRates, askMarket } = require('./lib/market-lookup');

const STATE_DIR = path.join(os.homedir(), '.claude', 'channels', 'telegram');
const IDLE_MS = 30 * 60 * 1000;
const GUIDE = `Chào bạn, mình là BossTele, trợ lý tra cứu hàng của BaoQ Luxury.

🔎 Tra cứu sản phẩm
• tìm tên "Chanel" : tìm theo tên
• tìm sku SP014899 : tìm theo mã
• xem thêm : xem 10 món tiếp theo
• chọn 2 : chọn dòng số 2 trong kết quả
Mặc định tìm cả KiotViet và Sapo; thêm nguồn=kiot hoặc nguồn=sapo ở cuối để chỉ tìm một nơi.

💰 Tính giá bán
• tính giá vốn=150000000 chi_phí=0 cách=markup tỷ_lệ=12.5
markup là lời tính trên vốn, margin là lời tính trên giá bán. Gõ số liền, không dấu chấm.

📷 Soạn nháp lên hàng (chỉ nháp, không tự ghi)
• gửi ảnh sản phẩm, ghi kèm giá thu, tình trạng nếu có : nháp lên Kiot (tên, mã dòng sản phẩm, mô tả)
• ảnh kèm chữ "web" : nháp đăng web; ảnh giày kèm "web giày"

💬 Hỏi tự do
• túi Hermes nào còn hàng?
• SP014899 lời bao nhiêu?
Câu hỏi tự do do Claude trả lời, mất khoảng 10 đến 60 giây.

🌐 Giá thị trường
• dán thẻ sản phẩm rồi thêm "tìm trên thị trường" (hoặc "check giá ngoài", "giá tham khảo")
Claude tra Google và các trang bán lại, báo giá hãng, giá secondhand kèm link và so với giá shop, mất khoảng 1 đến 3 phút.

🤝 Giá chốt với khách
• SP014899 giá chốt : bot gửi thẻ có vốn, lời, tuổi tồn, Sale AI rồi hỏi khách trả bao nhiêu
• gõ giá khách trả, ví dụ 58tr : bot tính lời và gợi ý chốt hay trả ngược
• bấm Hợp lý, hoặc Chưa đúng rồi gõ giá chốt và lý do : bot lưu góp ý, lần sau xét lại cho mẫu đó

🏷 Lệch kho web
• lệch kho : món web còn bán nhưng Kiot đã hết hoặc khách đang giữ (9 giờ sáng bot tự báo nếu có)

🧠 Ghi nhớ
• nhớ: báo giá theo triệu cho gọn : bot nhớ lâu dài
• quên: báo giá : xóa điều đã nhớ có chữ này
• /nho : xem bot đang nhớ gì
Bot cũng nhớ cuộc trò chuyện gần đây, kể cả sau khi khởi động lại.

Gõ /help để xem lại hướng dẫn này.`;
// Shown in Telegram before START and in the command menu.
const PROFILE = [
  ['setMyShortDescription', { short_description: 'Tra cứu sản phẩm, giá và tồn kho BaoQ Luxury.' }],
  ['setMyDescription', { description: 'Trợ lý tra cứu sản phẩm, giá bán và tồn kho của BaoQ Luxury. Bấm Bắt đầu để xem hướng dẫn.' }],
  ['setMyCommands', { commands: [{ command: 'start', description: 'Bắt đầu' }, { command: 'help', description: 'Hướng dẫn sử dụng' }, { command: 'nho', description: 'Xem bot đang nhớ gì' }] }],
];
const SYSTEM = [
  'Bạn là trợ lý BaoQ Luxury, trả lời chủ shop qua Telegram, tiếng Việt, văn bản thường, không markdown.',
  'Chỉ trả lời về sản phẩm, giá, tồn kho, khách hàng và kinh doanh của BaoQ; câu khác thì từ chối một câu.',
  'Tra sản phẩm bằng: node catalog.js --q "<từ khóa>" [--hot] [--in-stock] [--sort newest|cheap|expensive] [--min <đồng>] [--max <đồng>] [--limit 10] [--offset 10].',
  'catalog.js là danh mục KiotViet giống trang web, mới nhất trước; total là tổng số món khớp, cost là giá vốn cao nhất giữa các chi nhánh; reserved > 0 là món khách đã cọc giữ: báo "đang giữ cho khách", không nói còn hàng để bán cho người khác.',
  'Chỉ dùng node search-products.js --source kiotviet --sku <SKU> khi cần kiểm tồn trực tiếp một SKU.',
  'Không bịa SKU, giá, tồn. Không sửa file, không ghi lên KiotViet/Sapo.',
  'Khi trả lời danh sách sản phẩm: dòng 1 là một câu tóm tắt, ví dụ "Có 233 túi Chanel phù hợp (hiện 10 món mới nhất):".',
  'Dòng 2 ghi "SKU:" rồi các SKU cách nhau dấu phẩy, đúng số món người hỏi muốn (mặc định 10, tối đa 10). Không ghi tên, giá, tồn: bot tự gửi thẻ ảnh có đủ thông tin.',
  'Nếu total lớn hơn số đã hiện thì dòng 3: Nhắn "mẫu khác" để xem thêm. Với "mẫu khác" thì gọi lại cùng điều kiện với --offset tăng 10.',
  'Không chia nhóm, không nhận xét, không gợi ý khi không được hỏi. Câu hỏi khác (lời bao nhiêu, so sánh...) trả lời tối đa 3 câu ngắn.',
  'Người hỏi hay gõ sai chính tả hoặc không dấu (chanl, hermess, tui xach, con hag): tự hiểu đúng ý rồi tra, đầu câu trả lời ghi ngắn đã hiểu là gì nếu có sửa.',
  'Trong câu trả lời khác, khi nhắc sản phẩm cụ thể thì ghi SKU: bot tự gửi thẻ ảnh cho các SKU đó.',
  'Bảo có sổ ghi nhớ (ở cuối hướng dẫn này): luôn làm theo. Khi Bảo dặn một thói quen, quy ước hay sự thật cần nhớ lâu dài (không phải câu tra cứu thường), thêm dòng cuối dạng "GHI NHỚ: <nội dung ngắn>", mỗi điều một dòng.',
  'Hỏi giá sale, quyền sale, giảm được bao nhiêu: chạy node sale-price.js <SKU...> (công thức tool Sale AI, chỉ đọc). price là giá sale P_M, allowance là quyền sale tối đa, net là giá thấp nhất sau quyền sale, m là mốc M. Không gọi các số này là giá chốt.',
].join(' ');

const STAFF_RULE = 'Người đang hỏi là nhân viên, không phải Bảo: không nói giá vốn, tiền lời, % lời hay giá thu; chỉ giá bán và mức được bớt.';
function askClaude(question, { sessionId, resume, notes = [], context = '', staff = false }, timeoutMs = 180_000) {
  const base = staff ? `${SYSTEM} ${STAFF_RULE}` : SYSTEM;
  const system = notes.length ? `${base}\n\nSổ ghi nhớ của Bảo:\n${notes.map(note => `- ${note}`).join('\n')}` : base;
  // Claude only sees its own turns in its session; the recent chat also has answers the bot gave by code (cards, sale prices).
  const prompt = context ? `Cuộc trò chuyện gần đây (gồm cả câu bot tự trả lời bằng code):\n${context}\n\nCâu hỏi hiện tại: ${question}` : question;
  return new Promise((resolve, reject) => {
    // Variables inherited from a parent Claude session would make this a child session of it.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^CLAUDE_?CODE/i.test(key)));
    if (staff) env.BOSSTELE_HIDE_COST = '1'; // catalog.js and sale-price.js leave cost out
    const child = spawn('claude', ['-p', '--output-format', 'text', resume ? '--resume' : '--session-id', sessionId,
      '--append-system-prompt', system, '--allowedTools', 'Bash(node catalog.js:*)', 'Bash(node sale-price.js:*)', 'Bash(node search-products.js:*)'],
    { cwd: __dirname, env, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', chunk => { output += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && output.trim()) resolve(output.trim());
      else reject(new Error(`claude -p kết thúc với mã ${code}`));
    });
    child.stdin.end(prompt);
  });
}

const vnd = value => `${Math.round(value).toLocaleString('vi-VN')}đ`;
const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
// "giá sale", "quyền sale", "giảm giá", "markdown": answered with the Sale AI formula, never called "giá chốt" (PRICE-SYSTEM is not set).
// "nên bán giá nhiêu hợp lý" asks for a selling price too; the Sale AI price is the answer the shop uses.
const saleIntent = text => /\bsale\b|\bgiam gia\b|\bgia giam\b|\bmarkdown\b|\bnen ban\b|\bhop ly\b/.test(fold(text));
const saleWords = /gi[aá]\s*sale|quy[eề]n\s*sale|gi[aả]m\s*gi[aá]|gi[aá]\s*gi[aả]m|markdown|\bsale\b/gi;
// One short message per product (photo + caption); M, age and P0 stay in Sale AI.
function saleCaption(product, row, date) {
  if (!row || row.status !== 'simulated') {
    return [product.name, `${product.sku} · Chưa tính được giá sale: ${(row?.reasons?.length ? row.reasons : ['không rõ lý do']).join('; ')}`].join('\n');
  }
  return [
    product.name,
    `${product.sku}${row.type === 'hottrend' ? ' · Hot' : ''} · ${row.stock > 0 ? `Còn ${row.stock}` : 'Hết hàng'}`,
    `Giá sale ${date}: ${vnd(row.price)}${row.currentPrice !== row.price ? ` (Kiot đang ${vnd(row.currentPrice)})` : ''}`,
    row.allowance > 0 ? `Bớt thêm tối đa ${vnd(row.allowance)} (thấp nhất ${vnd(row.net)})` : 'Không bớt thêm được',
  ].join('\n');
}
// Bảo 2026-10-20 (TASK-040): "giá chốt" is a short exchange: facts card → customer's offer → one-line suggestion → Bảo's feedback.
// The pricing formula comes later (PRICE-SYSTEM); the suggestion is Claude's judgment on the facts and Bảo's past feedback.
const closeIntent = text => /\bgia chot\b|\bchot gia\b|\bkhach tra\b|\bchot duoc\b|\bchot bao nhieu\b/.test(fold(text));
const tr = value => `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr`;
const percent = (part, base) => `${(Math.round(part / base * 1000) / 10).toLocaleString('vi-VN')}%`;
/** "58tr", "58,5 triệu", "58tr5", "58.000.000", or a bare 1–999 (triệu); SKUs and percentages are ignored. */
function parseMoney(text) {
  const t = fold(text).replace(/\bsp\d+\b/g, ' ');
  let match = t.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)(?![a-z])\s*(\d{1,3}(?![\d%]))?/);
  if (match) return Math.round(Number(match[1].replace(',', '.')) * 1e6 + (match[2] ? Number(match[2]) * 10 ** (6 - match[2].length) : 0));
  match = t.match(/\d{1,3}(?:[.,]\d{3}){2,}|\d{7,}/);
  if (match) return Number(match[0].replace(/[.,]/g, ''));
  match = t.match(/(?<![\w.,])(\d{1,3}(?:[.,]\d)?)(?![\d.,]|\s*%)/);
  return match ? Math.round(Number(match[1].replace(',', '.')) * 1e6) : null;
}
const listPrice = (product, row) => (product.price > 0 ? product.price : row?.currentPrice) || null;
function closeCaption(product, row, staff = false) {
  const price = listPrice(product, row);
  const lines = [product.name, `${product.sku} · ${held(product)}`];
  if (staff) lines.push(`Đang bán ${price ? tr(price) : 'chưa có giá'}`);
  else lines.push(row?.cost && price ? `Đang bán ${tr(price)} · Vốn ${tr(row.cost)} · Lời ${tr(price - row.cost)} (${percent(price - row.cost, row.cost)})`
    : `Đang bán ${price ? tr(price) : 'chưa có giá'} · Chưa có giá vốn`);
  if (row?.status === 'simulated') {
    const sale = row.price < price ? `Sale AI hôm nay ${tr(row.price)}${row.allowance > 0 ? `, thấp nhất ${tr(row.net)}` : ''}`
      : row.allowance > 0 ? `Sale AI cho bớt tới ${tr(row.net)}` : 'Sale AI chưa cho bớt';
    lines.push(`Tồn ${row.ageDays} ngày · M${row.m} · ${row.type === 'hottrend' ? 'Hot' : 'Không Hot'} · ${sale}`);
  } else if (row) lines.push(`Sale AI chưa tính được: ${(row.reasons ?? []).join('; ') || 'không rõ lý do'}`);
  return lines.join('\n');
}
function offerLine({ product, row }, offer, staff = false) {
  const price = listPrice(product, row), parts = [];
  if (staff) { if (row?.status === 'simulated' && offer < row.net) parts.push(`dưới mức Sale AI cho bớt (${tr(row.net)})`); }
  else if (row?.cost) parts.push(offer >= row.cost ? `lời ${tr(offer - row.cost)} (${percent(offer - row.cost, row.cost)})` : `lỗ ${tr(row.cost - offer)} so với vốn`);
  if (price) parts.push(offer < price ? `thấp hơn giá bán ${tr(price - offer)}` : 'bằng hoặc cao hơn giá bán');
  return `${tr(offer)}: ${parts.join(', ') || 'chưa có vốn và giá bán để so'}`;
}
// Bảo 2026-10-20 case 10: a customer's deposit (Kiot đặt hàng → reserved) holds the item, so it is not "còn hàng" for another buyer.
function held(product) {
  if (product.onHand === null || product.onHand === undefined) return 'Không quản lý tồn';
  if (product.onHand <= 0) return 'Hết hàng';
  if (product.reserved >= product.onHand) return 'Đang giữ cho khách (đã cọc)';
  return `Còn ${product.onHand}${product.reserved ? ` · ${product.reserved} đang giữ cho khách` : ''}`;
}
/** Same facts as the web product card: name, SKU, price, stock, Hot. */
function card(product) {
  const stock = held(product);
  return [product.name, `${product.sku} · ${product.price > 0 ? vnd(product.price) : 'Chưa có giá'}`, `${stock}${product.hotTrend ? ' · Hot' : ''}`].join('\n');
}

/** The web assistant's code-only answer (server /internal/assistant), or null so Claude answers instead. */
function webQuick({ url = process.env.BOSSTELE_WEB_URL || 'http://127.0.0.1:4000', token = process.env.INTERNAL_TOKEN } = {}) {
  return async (messages, { staff = false } = {}) => {
    if (!token) return null;
    try {
      const response = await fetch(`${url}/internal/assistant`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token, ...(staff ? { 'x-bosstele-staff': '1' } : {}) },
        body: JSON.stringify({ messages }), signal: AbortSignal.timeout(15_000),
      });
      return response.ok ? (await response.json()).answer ?? null : null;
    } catch { return null; }
  };
}

function createBot({ api, allowFrom, owner = null, newSession, ask = askClaude, quick: webLookup = async () => null, salePrices = null, memory = null, market = null, rates = async () => null, now = Date.now, feedback = null, thinkMs = 2000, pair = null, fileUrl = null, draft = null, albumMs = 1500, stockGap = null, permissionsFor = null }) {
  const sessions = new Map(), conversations = new Map(), histories = new Map(), closingStates = new Map();
  // Bảo 2026-10-20: everyone but the owner is staff (no cost, profit or purchase rates). Without an owner (tests) nobody is.
  // shortcut: one flag for the update being handled; fine while the polling loop handles one message at a time.
  let staff = false;
  const ownerId = () => (typeof owner === 'function' ? owner() : owner) || null;
  // Bảo 2026-10-20: a Telegram account linked to a website login follows that login ("Xem giá vốn" = sees cost and profit);
  // an unlinked one falls back to owner vs staff. permissionsFor: id → permissions[], null (no active account), undefined (not linked).
  async function isStaff(id) {
    let permissions;
    try { permissions = await permissionsFor?.(id); } catch { permissions = null; }
    if (permissions !== undefined) return !permissions?.includes('products.cost');
    return !!ownerId() && String(id) !== String(ownerId());
  }
  const quick = messages => webLookup(messages, { staff });
  // An open "giá chốt" exchange is saved with the chat, so "Chưa đúng" still works after the bot restarts.
  const closing = {
    get: chatId => closingStates.get(chatId),
    set: (chatId, state) => { closingStates.set(chatId, state); persist(chatId); },
    delete: chatId => { if (closingStates.delete(chatId)) persist(chatId); },
  };
  // Load a chat's saved turns and Claude session once, so a restarted bot continues the same conversation.
  const load = chatId => {
    if (histories.has(chatId)) return;
    const saved = memory?.loadChat(chatId);
    histories.set(chatId, Array.isArray(saved?.history) ? saved.history : []);
    if (saved?.conversation) conversations.set(chatId, saved.conversation);
    if (saved?.closing) closingStates.set(chatId, saved.closing);
  };
  const persist = chatId => memory?.saveChat(chatId, { history: histories.get(chatId) ?? [], conversation: conversations.get(chatId) ?? null, closing: closingStates.get(chatId) ?? null });
  const send = async (chatId, text, extra = {}) => {
    for (let start = 0; start < text.length; start += 4000) await api('sendMessage', { chat_id: chatId, text: text.slice(start, start + 4000), ...extra });
  };
  // Last 20 turns are kept; the web assistant reads at most 10 to page "mẫu khác".
  const remember = (chatId, role, content) => {
    histories.set(chatId, [...(histories.get(chatId) ?? []), { role, content: content.slice(0, 2000) }].slice(-20));
    persist(chatId);
  };
  // "nhớ: …", "quên: …", "/nho": the long-term notebook, handled by code so nothing is lost or invented.
  function memoryCommand(chatId, text) {
    const folded = fold(text.trim()), body = text.slice(text.indexOf(':') + 1).trim();
    if (/^(ghi )?nho\s*:/.test(folded)) {
      const note = memory.add(body);
      return send(chatId, note ? `Đã ghi nhớ: ${note}` : 'Bạn ghi nội dung cần nhớ sau dấu hai chấm nhé.');
    }
    if (/^quen\s*:/.test(folded)) {
      const removed = memory.forget(body);
      return send(chatId, removed ? `Đã quên ${removed} điều có chữ "${body}".` : `Không có điều nào có chữ "${body}".`);
    }
    if (['/nho', 'ban nho gi', 'nho gi'].includes(folded.replace(/[?!.]+$/, '').split('@')[0])) {
      const notes = memory.notes();
      return send(chatId, notes.length ? `Mình đang nhớ:\n${notes.map((note, index) => `${index + 1}. ${note}`).join('\n')}` : 'Mình chưa ghi nhớ điều gì. Nhắn "nhớ: ..." để thêm.');
    }
    return null;
  }
  async function sendCard(chatId, product, caption = card(product)) {
    // Telegram downloads the KiotViet image itself; a broken image still shows the card as text.
    if (product.image) {
      try { return await api('sendPhoto', { chat_id: chatId, photo: product.image, caption }); } catch { /* text card below */ }
    }
    return send(chatId, caption);
  }
  async function sendAnswer(chatId, answer) {
    const keyboard = answer.suggestions?.length
      ? { reply_markup: { keyboard: answer.suggestions.map(text => [{ text }]), one_time_keyboard: true, resize_keyboard: true } } : {};
    await send(chatId, answer.reply, keyboard);
    for (const product of answer.products ?? []) await sendCard(chatId, product);
  }
  // Find the products like a normal look-up (words other than "sale"), then price them with the Sale AI formula.
  async function saleAnswer(chatId, text) {
    // SKUs win (a pasted card has one); otherwise search with the words other than "sale".
    const skus = [...new Set((text.match(/\bSP\d{4,}\b/gi) ?? []).map(sku => sku.toUpperCase()))].slice(0, 10);
    const lookups = skus.length ? skus : [text.replace(saleWords, ' ').replace(/\s+/g, ' ').trim() || text];
    const products = [];
    for (const lookup of lookups) {
      for (const product of (await quick([{ role: 'user', content: lookup }]))?.products ?? []) {
        if ((!skus.length || product.sku === lookup) && !products.some(item => item.sku === product.sku)) products.push(product);
      }
    }
    if (!products.length) return false;
    let result;
    try { result = await salePrices(products.map(product => product.sku)); }
    catch (error) { await send(chatId, `Chưa đọc được giá sale từ Sale AI: ${error.message}`); return true; }
    const [, month, day] = result.day.split('-');
    const captions = products.map((product, index) => saleCaption(product, result.rows[index], `${day}/${month}`));
    remember(chatId, 'assistant', captions.join('\n\n'));
    for (const [index, product] of products.entries()) await sendCard(chatId, product, captions[index]);
    return true;
  }
  // "tìm con này trên thị trường": Claude searches the web (skill tra-gia-thi-truong) with the shop's listing; 1–3 minutes, so typing is kept alive.
  async function marketAnswer(chatId, text) {
    const products = [];
    for (const sku of [...new Set((text.match(/\bSP\d{4,}\b/gi) ?? []).map(sku => sku.toUpperCase()))].slice(0, 3)) {
      const product = (await quick([{ role: 'user', content: sku }]))?.products?.find(item => item.sku === sku);
      if (product) products.push(product);
    }
    await send(chatId, 'Đang tra giá thị trường, khoảng 1–3 phút…');
    const typing = setInterval(() => api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {}), 4000);
    let parts;
    const prompt = marketPrompt({ text, products, rates: await rates(), today: new Date(now()) });
    try { parts = splitReply(await market(prompt, { image: products[0]?.image ?? null })); }
    catch { parts = []; }
    finally { clearInterval(typing); }
    if (!parts.length) parts = ['Chưa tra được giá thị trường, bạn thử lại sau nhé.'];
    remember(chatId, 'assistant', parts.join('\n\n'));
    for (const part of parts) await send(chatId, part, { link_preview_options: { is_disabled: true } });
  }
  // Same cards as web answers for the first 10 SKUs Claude mentions, looked up through the web server.
  async function sendMentioned(chatId, reply) {
    for (const sku of [...new Set(reply.match(/\bSP\d{4,}\b/g) ?? [])].slice(0, 10)) {
      const product = (await quick([{ role: 'user', content: sku }]))?.products?.find(item => item.sku === sku);
      if (product) await sendCard(chatId, product);
    }
  }
  // Bảo 2026-10-20: while Claude answers, a "•• 6s · Đang suy nghĩ" line (like Claude Code's "6s · Thinking") counts the seconds;
  // it appears after 2 s, so quick answers never flash it, and is deleted when the answer arrives. Returns stop().
  function thinking(chatId, everyMs = thinkMs) {
    const started = Date.now();
    let message = null, sending = null, tick = 0, done = false;
    const label = () => `${'•'.repeat(tick % 3 + 1)} ${Math.round((Date.now() - started) / 1000)}s · Đang suy nghĩ`;
    const remove = () => message?.message_id && api('deleteMessage', { chat_id: chatId, message_id: message.message_id }).catch(() => {});
    api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
    const timer = setInterval(() => {
      tick++;
      api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
      if (sending) return;
      sending = (message ? api('editMessageText', { chat_id: chatId, message_id: message.message_id, text: label() })
        : api('sendMessage', { chat_id: chatId, text: label() }).then(result => { message = result; }))
        .catch(() => {}).finally(() => { sending = null; if (done) remove(); });
    }, everyMs);
    return async () => { done = true; clearInterval(timer); if (!sending) await remove(); };
  }
  const keyboard = rows => ({ reply_markup: { keyboard: rows.map(row => row.map(text => ({ text }))), one_time_keyboard: true, resize_keyboard: true } });
  const noKeyboard = { reply_markup: { remove_keyboard: true } };
  const askOffer = (chatId, buttons) => send(chatId, 'Khách trả bao nhiêu? Gõ số, ví dụ 58tr.', keyboard([buttons]));
  // The SKU in the question, else the last SKU of the chat ("thế giá chốt nên là nhiu" right after a card).
  async function closeProduct(chatId, text) {
    const sku = text.match(/\bSP\d{4,}\b/i)?.[0]?.toUpperCase()
      ?? [...(histories.get(chatId) ?? [])].reverse().map(turn => turn.content.match(/\bSP\d{4,}\b/)?.[0]).find(Boolean);
    if (!sku) return null;
    return (await quick([{ role: 'user', content: sku }]))?.products?.find(item => item.sku === sku) ?? null;
  }
  async function closeStart(chatId, text, from = {}) {
    const product = await closeProduct(chatId, text);
    if (!product) return false;
    let row = null;
    try { row = salePrices ? (await salePrices([product.sku])).rows[0] ?? null : null; } catch { /* the card still has price and stock */ }
    const state = { product, row, step: 'offer', staff, requester: from.username ? `@${from.username}` : from.first_name ?? String(from.id ?? '') }, caption = closeCaption(product, row, staff);
    closing.set(chatId, state);
    remember(chatId, 'assistant', caption);
    await sendCard(chatId, product, caption);
    // "SP… khách trả 58tr" already has the offer.
    const offer = /\bkhach tra\b/.test(fold(text)) ? parseMoney(text) : null;
    if (offer) await closeSuggest(chatId, state, offer);
    else await askOffer(chatId, market ? ['Tra giá thị trường', 'Bỏ qua'] : ['Bỏ qua']);
    return true;
  }
  async function closeSuggest(chatId, state, offer) {
    const line = offerLine(state, offer, state.staff), past = feedback?.similar(state.product) ?? [];
    const prompt = [
      'Bảo đang chốt giá với khách. Dữ kiện đã tính sẵn, không tính thêm số khác, không chạy công cụ:',
      closeCaption(state.product, state.row, state.staff), `Khách trả ${line}`,
      past.length ? `Góp ý trước của Bảo cho mẫu này:\n${past.map(entry => `- ${entry.sku}: khách trả ${entry.offer ? tr(entry.offer) : '?'}, bot gợi ý "${entry.suggestion ?? ''}", Bảo ${entry.verdict === 'ok' ? 'thấy hợp lý' : `chốt ${entry.finalPrice ? tr(entry.finalPrice) : '?'} vì ${entry.reason ?? ''}`}`).join('\n')}` : 'Chưa có góp ý trước cho mẫu này.',
      'Trả lời đúng 1 dòng, tối đa 25 chữ: nhận định ngắn, rồi "→" và gợi ý (chốt được, hoặc trả ngược khoảng bao nhiêu tr). Ví dụ: Túi mới (M0), chưa vào đợt sale → nên giữ giá, trả ngược 61–62tr. Không markdown.',
    ].join('\n');
    const stop = thinking(chatId);
    let suggestion = null;
    try { suggestion = (await ask(prompt, { sessionId: randomUUID(), resume: false, notes: memory?.notes() ?? [], staff: state.staff })).split('\n').map(part => part.trim()).find(Boolean) ?? null; }
    catch { /* the offer line still helps */ }
    finally { await stop(); }
    Object.assign(state, { step: 'verdict', offer, suggestion });
    // Case 11: staff offering under cost — they are not told the cost, Bảo is told and decides.
    const underCost = state.staff && state.row?.cost && offer < state.row.cost && ownerId();
    if (underCost) await send(ownerId(), `⚠ ${state.requester} đang chốt ${state.product.sku} (${state.product.name}): khách trả ${tr(offer)}, dưới vốn ${tr(state.row.cost - offer)}. Cần anh duyệt.`).catch(() => {});
    const reply = `${line}\n${suggestion ?? 'Chưa có gợi ý (Claude chưa trả lời).'}${underCost ? '\nGiá này cần anh Bảo duyệt, bot đã báo anh Bảo.' : ''}`;
    remember(chatId, 'assistant', reply);
    await send(chatId, reply, keyboard([['Hợp lý', 'Chưa đúng']]));
  }
  const record = (state, verdict, extra = {}) => feedback?.add({
    sku: state.product.sku, name: state.product.name, listPrice: listPrice(state.product, state.row), cost: state.row?.cost ?? null,
    sale: state.row?.status === 'simulated' ? { m: state.row.m, ageDays: state.row.ageDays, price: state.row.price, net: state.row.net, hot: state.row.type === 'hottrend' } : null,
    offer: state.offer ?? null, suggestion: state.suggestion ?? null, verdict, ...extra,
  });
  /** One step of an open closing-price exchange; false = the message is a new question. */
  async function closeStep(chatId, text, state) {
    const answer = fold(text.trim());
    if (answer === 'bo qua') { closing.delete(chatId); await send(chatId, 'Đã bỏ qua.', noKeyboard); return true; }
    if (state.step === 'offer') {
      if (answer === 'tra gia thi truong' || marketIntent(text)) {
        if (!market) { await send(chatId, 'Chưa bật tra giá thị trường.'); return true; }
        await marketAnswer(chatId, `${state.product.sku} tìm trên thị trường`);
        await askOffer(chatId, ['Bỏ qua']);
        return true;
      }
      const offer = parseMoney(text);
      if (offer) { await closeSuggest(chatId, state, offer); return true; }
    }
    if (state.step === 'verdict') {
      if (answer === 'hop ly') { record(state, 'ok'); closing.delete(chatId); await send(chatId, 'Đã ghi nhận: gợi ý hợp lý.', noKeyboard); return true; }
      if (answer === 'chua dung') { state.step = 'reason'; persist(chatId); await send(chatId, 'Anh chốt bao nhiêu, vì sao?', noKeyboard); return true; }
      if (/\bkhach tra\b/.test(answer) && parseMoney(text)) { await closeSuggest(chatId, state, parseMoney(text)); return true; }
    }
    if (state.step === 'reason') {
      const finalPrice = parseMoney(text);
      record(state, 'wrong', { finalPrice, reason: text.trim().slice(0, 500) });
      closing.delete(chatId);
      await send(chatId, `Đã lưu góp ý${finalPrice ? `: chốt ${tr(finalPrice)}` : ''}. Lần sau hỏi mẫu này bot sẽ xét lại.`);
      return true;
    }
    closing.delete(chatId);
    return false;
  }
  // Bảo 2026-10-20: a product photo becomes a draft for Kiot or the website (lib/listing-draft.js); nothing is written anywhere.
  // Telegram sends an album as one message per photo with the same media_group_id: collect them for albumMs, then draft once.
  const albums = new Map();
  function collectAlbum(chatId, message) {
    const key = `${chatId}:${message.media_group_id}`;
    let album = albums.get(key);
    if (!album) {
      album = { messages: [], staff };
      albums.set(key, album);
      setTimeout(() => { albums.delete(key); photoAnswer(chatId, album.messages, album.staff).catch(error => console.error('BossTele bot: lỗi xử lý album:', error.message)); }, albumMs);
    }
    album.messages.push(message);
  }
  async function photoAnswer(chatId, messages, isStaff = staff) {
    load(chatId);
    const caption = messages.map(item => item.caption).find(Boolean) ?? '';
    let request;
    try { request = draftRequest(caption, new Date(now()), undefined, messages.length); } catch (error) { return send(chatId, error.message); }
    remember(chatId, 'user', `[Ảnh] ${caption}`.trim());
    await send(chatId, `Đang soạn nháp ${request.label}, khoảng 1–3 phút…`);
    const stop = thinking(chatId);
    let reply;
    try { reply = withoutSources(await draft(request.prompt, { image: await Promise.all(messages.map(item => fileUrl(item.photo.at(-1).file_id))), system: request.system, bash: request.bash, staff: isStaff })); }
    catch { reply = 'Chưa soạn được nháp, bạn thử lại sau nhé.'; }
    finally { await stop(); }
    if (request.lot) {
      try { reply = withLotPrices(reply, undefined, isStaff); }
      catch (error) { console.error('BossTele bot: chưa tính được gợi ý giá thu cả lô:', error.message); }
    } else if (request.skill === 'baoq-up-kiot') {
      try { reply = withBuyPrice(reply, /\bthu\b/.test(fold(caption)) ? parseMoney(caption) : null, undefined, isStaff); }
      catch (error) { console.error('BossTele bot: chưa tính được gợi ý giá thu:', error.message); }
    }
    reply = `${reply}\n\n(Bản nháp — chưa ghi lên đâu cả. Thấy đúng thì chép vào ${request.skill === 'baoq-up-kiot' ? 'Kiot' : 'trang quản trị web'}.)`;
    remember(chatId, 'assistant', reply);
    await send(chatId, reply);
  }
  async function handleUpdate(update) {
    const message = update.message;
    // Only private chats from allowlisted Telegram users; strangers get a pairing code at most (lib/telegram-access.js).
    if (!message || message.chat?.type !== 'private') return;
    // allowFrom is re-read on every message (a function) so an approved pairing works without restarting the bot.
    if (!(typeof allowFrom === 'function' ? allowFrom() : allowFrom).includes(String(message.from?.id))) {
      // Pairing (Bảo 2026-10-20): a stranger only gets a code; Bảo approves it on the computer, never from Telegram.
      let code = null;
      try { code = pair?.(message.from, message.chat.id) ?? null; } catch (error) { console.error('BossTele bot: không tạo được mã ghép nối:', error.message); }
      if (code) await send(message.chat.id, `Bạn chưa được dùng BossTele.\nMã ghép nối: ${code}\nGửi mã này cho chủ shop để được duyệt (mã có hạn 1 giờ).`);
      return;
    }
    const chatId = message.chat.id, text = message.text;
    staff = await isStaff(message.from?.id);
    if (typeof text !== 'string') {
      if (message.photo?.length && draft && fileUrl) return message.media_group_id ? collectAlbum(chatId, message) : photoAnswer(chatId, [message]);
      return send(chatId, `${REJECT}\nBot chỉ nhận tin nhắn chữ hoặc ảnh sản phẩm.`);
    }
    if (['/start', '/help'].includes(text.trim().split('@')[0])) return send(chatId, GUIDE);
    load(chatId);
    if (memory) { const handled = memoryCommand(chatId, text); if (handled) return handled; }
    if (parseCommand(text)) {
      closing.delete(chatId);
      if (!sessions.has(chatId)) sessions.set(chatId, newSession());
      return send(chatId, render(await sessions.get(chatId).handle(text)));
    }
    remember(chatId, 'user', text);
    await api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
    const open = closing.get(chatId);
    if (open && await closeStep(chatId, text, open)) return;
    // Case 9: answered by code from the Sapo list and the Kiot snapshot; read-only.
    if (stockGap && /^\/?lech ?kho\b|\blech kho\b/.test(fold(text.trim()))) {
      let report;
      try { report = await stockGap(); } catch (error) { report = `Chưa đối chiếu được web và Kiot: ${error.message}`; }
      remember(chatId, 'assistant', report);
      return send(chatId, report, { link_preview_options: { is_disabled: true } });
    }
    if (closeIntent(text) && await closeStart(chatId, text, message.from)) return;
    // Before the sale and web look-ups: a pasted card with "trên thị trường" would otherwise just get the card back.
    if (market && marketIntent(text)) return marketAnswer(chatId, text);
    if (salePrices && saleIntent(text) && await saleAnswer(chatId, text)) return;
    const answer = await quick(histories.get(chatId).slice(-10));
    // The web lookup found nothing; Claude can still search more broadly or answer from its own knowledge.
    if (answer?.reply && !/^Không tìm thấy sản phẩm/.test(answer.reply)) {
      remember(chatId, 'assistant', answer.reply);
      return sendAnswer(chatId, answer);
    }
    if (!storeQuestion(text)) return send(chatId, `${REJECT}\nVí dụ: tìm tên "Chanel" hoặc hỏi "túi Chanel nào đang bán chạy?"`);
    // Follow-ups like "mẫu khác" need the previous answer: keep one Claude conversation per chat until 30 idle minutes.
    let conversation = conversations.get(chatId);
    if (!conversation || now() - conversation.last > IDLE_MS) conversation = { sessionId: randomUUID(), started: false };
    conversation.last = now();
    conversations.set(chatId, conversation);
    const context = histories.get(chatId).slice(0, -1).slice(-10)
      .map(turn => `${turn.role === 'user' ? 'Bảo' : 'Bot'}: ${turn.content.slice(0, 500)}`).join('\n');
    let reply;
    const stop = thinking(chatId);
    try {
      reply = await ask(text, { sessionId: conversation.sessionId, resume: conversation.started, notes: memory?.notes() ?? [], context, staff });
      conversation.started = true;
    } catch {
      conversations.delete(chatId); // a half-created session id cannot be reused with --session-id
      reply = 'Claude chưa trả lời được, bạn thử lại sau nhé.';
    } finally { await stop(); }
    // "GHI NHỚ: …" lines are Claude asking to remember something; save them and show a short confirmation instead.
    const learned = [...reply.matchAll(/^\s*GHI NHỚ:\s*(.+)$/gim)].map(match => memory?.add(match[1])).filter(Boolean);
    if (learned.length) reply = `${reply.replace(/^\s*GHI NHỚ:.*$/gim, '').trim()}\n(Đã ghi nhớ: ${learned.join('; ')})`;
    remember(chatId, 'assistant', reply);
    // The "SKU:" line only feeds the photo cards; the chat shows the headline and the cards.
    await send(chatId, reply.split('\n').filter(line => !/^SKU:/i.test(line.trim())).join('\n').trim() || reply);
    return sendMentioned(chatId, reply);
  }
  return { handleUpdate };
}

function telegramApi(token) {
  return async (method, body) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(65_000),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(`${method}: ${data.description}`);
    return data.result;
  };
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN || /^TELEGRAM_BOT_TOKEN=(\S+)/m.exec(fs.readFileSync(path.join(STATE_DIR, '.env'), 'utf8'))?.[1];
  const allowFrom = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'access.json'), 'utf8')).allowFrom?.map(String) ?? [];
  if (!token || !allowFrom.length) throw new Error('Thiếu token bot hoặc danh sách người được phép trong ~/.claude/channels/telegram.');
  const api = telegramApi(token);
  let backend;
  const newSession = () => createChatSession({ search: async options => (backend ||= createProductSearch(loadConnectionConfig()))(options) });
  const access = createAccess();
  // Case 9: Sapo Web list (read-only) against the Kiot snapshot the website keeps.
  const stockGap = async () => {
    const sapo = await createCatalogFetcher(loadConnectionConfig())('sapo-web');
    if (sapo.status !== 'ok') throw new Error(sapo.message);
    const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'data', 'catalog-cache.json'), 'utf8'));
    return stockGapText(stockGaps(snapshot.rows?.kiotviet ?? [], sapo.items), { syncedAt: snapshot.syncedAt });
  };
  // Permissions of the linked website login, asked from the web server (same INTERNAL_TOKEN as the quick answers); cached 5 minutes.
  const permissionCache = new Map();
  const permissionsFor = async id => {
    const email = access.emailFor(id);
    if (!email) return undefined;
    const cached = permissionCache.get(email);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.permissions;
    const response = await fetch(`${process.env.BOSSTELE_WEB_URL || 'http://127.0.0.1:4000'}/internal/staff-permissions`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
      body: JSON.stringify({ email }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`web trả ${response.status}`);
    const { permissions } = await response.json();
    permissionCache.set(email, { at: Date.now(), permissions });
    return permissions;
  };
  const bot = createBot({ api, allowFrom: access.allowFrom, owner: access.owner, permissionsFor, pair: access.pairingCode, newSession, quick: webQuick(), salePrices: createSalePricer(), memory: createMemory(), market: askMarket, rates: exchangeRates, feedback: createPriceFeedback(),
    // The download URL holds the bot token: it is only fetched here (imageBlock), never shown to Claude.
    stockGap,
    fileUrl: async fileId => `https://api.telegram.org/file/bot${token}/${(await api('getFile', { file_id: fileId })).file_path}`, draft: askMarket });
  for (const [method, body] of PROFILE) await api(method, body).catch(error => console.error(`BossTele bot: ${error.message}`));
  console.log('BossTele bot Telegram đang chạy.');
  // Case 9: every day around 9:00 (Vietnam), tell Bảo only when the website still sells something Kiot no longer has.
  // shortcut: the sent day lives in memory, so a restart after 9:00 may report again that day; persist it if that annoys.
  let reportedDay = null;
  setInterval(async () => {
    const [day, hour] = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).split(/[ :]/);
    if (hour !== '09' || reportedDay === day || !access.owner()) return;
    reportedDay = day;
    try { const report = await stockGap(); if (!report.startsWith('Web và Kiot khớp')) await api('sendMessage', { chat_id: access.owner(), text: report, link_preview_options: { is_disabled: true } }); }
    catch (error) { console.error('BossTele bot: báo lệch kho lỗi:', error.message); }
  }, 10 * 60 * 1000);
  let offset = 0;
  for (;;) {
    try {
      // shortcut: one message at a time, so a command waits while Claude answers; fine for one owner, queue per chat if staff join.
      for (const update of await api('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] })) {
        offset = update.update_id + 1;
        await bot.handleUpdate(update).catch(error => console.error('BossTele bot: lỗi xử lý tin:', error.message));
      }
    } catch (error) {
      console.error(/Conflict/.test(error.message)
        ? 'BossTele bot: bot đang bị phiên khác giữ (plugin Telegram của Claude còn bật?). Thử lại sau 5 giây.'
        : `BossTele bot: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

if (require.main === module) main().catch(error => { console.error(`BossTele bot: ${error.message}`); process.exitCode = 1; });
module.exports = { createBot, parseMoney };
