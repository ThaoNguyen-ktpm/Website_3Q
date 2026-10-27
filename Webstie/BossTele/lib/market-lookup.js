'use strict';

// Bảo 2026-10-20: "tìm con này trên thị trường" — Claude searches Google/resale sites for the model and compares with the shop price.
// The instructions live in the project skill so Claude in the terminal and the bot follow the same rules.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SKILL = path.join(__dirname, '..', '.claude', 'skills', 'tra-gia-thi-truong', 'SKILL.md');
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'AUD', 'CNY', 'KRW', 'CHF', 'THB'];
const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

// "thị trường", "check giá ngoài", "giá tham khảo", "trên mạng/google", "giá retail", resale site names.
// "giá hãng" only with accents: folded it is "giá hàng", which is any price question.
// Bảo 2026-10-21: "tra sàn Việt Nam", "các shop giống tui" — other shops' prices; "sàn" only with accents ("sẵn" folds to "san").
const marketIntent = text => /\bcac shop\b|\bshop (khac|giong|viet nam|vn|trong nuoc)\b|thi truong|\bgia (ben )?ngoai\b|\bben ngoai\b|\bgia tham khao\b|\btham khao gia\b|\btren (mang|google|web)\b|\bgia (retail|boutique|store)\b|\bmarket\b|\bresale\b|fashionphile|vestiaire|rebag|realreal|\bebay\b/
  .test(fold(String(text ?? ''))) || /giá (ở |tại |của |bên )?hãng|(?:^|[^\p{L}])sàn(?=$|[^\p{L}])/u.test(String(text ?? '').normalize('NFC').toLowerCase());

const guide = () => fs.readFileSync(SKILL, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
const ddmmyyyy = date => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

/** Today's VND rates from open.er-api.com (free, no key), or null so Claude looks the rate up itself. */
async function exchangeRates(fetchImpl = fetch) {
  try {
    const response = await fetchImpl('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10_000) });
    const data = await response.json();
    const vnd = data?.rates?.VND;
    if (data?.result !== 'success' || !(vnd > 0)) return null;
    const rates = CURRENCIES.filter(code => data.rates[code] > 0)
      .map(code => `1 ${code} = ${Math.round(vnd / data.rates[code]).toLocaleString('vi-VN')}đ`);
    return `${rates.join('; ')} (open.er-api.com, ${ddmmyyyy(new Date(data.time_last_update_unix * 1000))})`;
  } catch { return null; }
}

/** The task message for Claude: Bảo's text, the shop's own listing (no cost price) and today's rates. */
function marketPrompt({ text, products = [], rates = null, today = new Date() }) {
  const vnd = value => `${Math.round(value).toLocaleString('vi-VN')}đ`;
  const stock = product => product.onHand === null || product.onHand === undefined ? 'không quản lý tồn' : `còn ${product.onHand}`;
  return [
    `Ngày tra: ${ddmmyyyy(today)}`,
    `Tin của Bảo: ${text}`,
    products.length
      ? `Sản phẩm trong kho shop (KiotViet):\n${products.map(p => `- ${p.sku} · ${p.name} · giá niêm yết ${p.price > 0 ? vnd(p.price) : 'chưa có'} · ${stock(p)}`).join('\n')}`
      : 'Không tra được sản phẩm trong kho shop: lấy tên và giá shop từ tin của Bảo nếu có.',
    rates ? `Tỷ giá: ${rates}` : 'Chưa lấy được tỷ giá: tự tra tỷ giá hôm nay và ghi nguồn.',
    'Tra giá thị trường theo hướng dẫn và trả lời đúng định dạng.',
  ].join('\n\n');
}

/** Claude's reply split on "---" lines into separate Telegram messages. */
const splitReply = reply => reply.split(/^\s*-{3,}\s*$/m).map(part => part.trim()).filter(Boolean);

/** The shop's product photo (KiotViet image URL) as a Claude image block, so Claude can tell lambskin from caviar; null if it fails. */
async function imageBlock(url, fetchImpl = fetch) {
  if (!url) return null;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    const header = response.headers.get('content-type')?.split(';')[0];
    const data = Buffer.from(await response.arrayBuffer());
    // Telegram serves photos as application/octet-stream: recognise JPEG/PNG by their first bytes.
    const type = /^image\//.test(header ?? '') ? header : data[0] === 0xff && data[1] === 0xd8 ? 'image/jpeg' : data[0] === 0x89 && data[1] === 0x50 ? 'image/png' : header;
    if (!response.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type) || data.length > 5_000_000) return null;
    return { type: 'image', source: { type: 'base64', media_type: type, data: data.toString('base64') } };
  } catch { return null; }
}

/**
 * One-shot `claude -p` with only WebSearch/WebFetch: no shell or file tools, no MCP, no user settings or hooks,
 * run from an empty temp folder — web pages cannot steer it into reading .env or the catalog.
 * The photo goes in the message itself (stream-json), so no file tool is needed.
 */
// bash: exact read-only commands Claude may run besides the web (the photo draft searches the shop catalog), e.g. 'node D:/…/catalog.js:*'.
async function askMarket(prompt, { image = null, timeoutMs = 300_000, system = guide(), bash = [] } = {}) {
  const content = [{ type: 'text', text: prompt }];
  // One photo, or several (an album: the photo drafts send every photo).
  const urls = (Array.isArray(image) ? image : [image]).filter(Boolean);
  for (const [index, url] of urls.entries()) {
    const photo = await imageBlock(url);
    if (photo) content.push({ type: 'text', text: urls.length > 1 ? `Ảnh ${index + 1}:` : 'Ảnh sản phẩm của shop:' }, photo);
  }
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bosstele-market-'));
  return new Promise((resolve, reject) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^CLAUDE_?CODE/i.test(key)));
    const child = spawn('claude', ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
      '--setting-sources', 'project', '--strict-mcp-config', '--tools', bash.length ? 'WebSearch,WebFetch,Bash' : 'WebSearch,WebFetch',
      '--allowedTools', 'WebSearch', 'WebFetch', ...bash.map(command => `Bash(${command})`),
      '--append-system-prompt', system],
    { cwd, env, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const done = () => { clearTimeout(timer); fs.rm(cwd, { recursive: true, force: true }, () => {}); };
    child.stdout.on('data', chunk => { output += chunk; });
    child.on('error', error => { done(); reject(error); });
    child.on('close', code => {
      done();
      const result = output.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }).find(event => event.type === 'result');
      if (code === 0 && result && !result.is_error && result.result?.trim()) resolve(result.result.trim());
      else reject(new Error(`claude -p kết thúc với mã ${code}`));
    });
    child.stdin.end(`${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`);
  });
}

module.exports = { marketIntent, marketPrompt, splitReply, exchangeRates, imageBlock, askMarket, guide };
