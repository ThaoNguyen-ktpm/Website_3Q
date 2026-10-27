'use strict';

const { parseCommand, REJECT, HELP } = require('./chat-commands');
const { calculateTargetPrice } = require('./target-price');
const { SearchCache } = require('./search-cache');
const { createPricingAi } = require('./pricing-ai');

function createChatSession({ search, now = Date.now, ai = createPricingAi() } = {}) {
  const cache = new SearchCache({ now });
  let state = null;
  let visible = [];
  let selected = null;
  let calculation = null;
  let apiRequests = 0;

  async function fetchPage(entry) {
    const page = entry.page + 1;
    const options = { source: entry.source, kind: state.kind, query: state.query, page, startPage: page, maxPages: 1 };
    const key = JSON.stringify(options);
    let fetched = cache.get(key);
    if (!fetched) {
      let result;
      try { apiRequests++; [result] = await search(options); }
      catch { result = { status: 'error', message: 'Không đọc được sản phẩm từ nguồn này.' }; }
      if (!result || !Array.isArray(result.items) && result.status === 'ok') result = { status: 'error', message: 'Nguồn trả dữ liệu không hợp lệ.' };
      fetched = { result, fetchedAt: now() };
      cache.set(key, result, fetched.fetchedAt);
    }
    entry.latest = fetched.result;
    if (fetched.result.status !== 'ok') {
      entry.error = fetched.result.message || 'Không đọc được sản phẩm từ nguồn này.';
      return;
    }
    entry.error = null;
    entry.page = page;
    entry.fetchedAt = fetched.fetchedAt;
    entry.hasMore = fetched.result.hasMore === true;
    entry.queue.push(...fetched.result.items);
  }

  function display() {
    visible = [];
    while (visible.length < 10 && state.sources.some(entry => entry.queue.length)) {
      for (const entry of state.sources) {
        if (entry.queue.length && visible.length < 10) {
          visible.push({ ...entry.queue.shift(), fetchedAt: entry.fetchedAt });
        }
      }
    }
    const messages = [];
    for (const entry of state.sources) {
      if (entry.error) messages.push(`${entry.source}: ${entry.error}`);
      if (entry.fetchedAt !== null) {
        messages.push(`${entry.source}: dữ liệu lấy lúc ${new Date(entry.fetchedAt).toISOString()}.`);
        if (now() - entry.fetchedAt >= 120000) messages.push(`${entry.source}: dữ liệu đã quá 2 phút; tìm lại để làm mới.`);
      }
      if (entry.queue.length || entry.hasMore) messages.push(`${entry.source}: còn kết quả/trang chưa xem; gõ “xem thêm”.`);
      if (entry.latest?.warning && entry.hasMore) messages.push(`${entry.source}: ${entry.latest.warning}`);
    }
    if (!visible.length) messages.push(state.sources.some(entry => entry.hasMore || entry.error)
      ? 'Trang này chưa có kết quả hiển thị; chưa thể kết luận toàn danh mục không có sản phẩm.'
      : 'Không còn kết quả phù hợp.');
    return { action: 'results', rows: visible, messages, aiCalls: ai.calls };
  }

  return {
    get stats() { return { aiCalls: ai.calls, apiRequests, cacheEntries: cache.entries.size }; },
    async handle(input) {
      const command = parseCommand(input);
      if (!command) return { action: 'blocked', message: REJECT, aiCalls: ai.calls };
      if (command.action === 'help') return { action: 'help', message: HELP, aiCalls: ai.calls };
      if (command.action === 'exit') return { action: 'exit', message: 'Đã thoát BossTele.', aiCalls: ai.calls };
      if (command.action === 'search') {
        const sourceNames = { kiot: ['kiotviet'], sapo: ['sapo-web'], all: ['kiotviet', 'sapo-web'] };
        state = { kind: command.kind, query: command.query, sources: sourceNames[command.source].map(source => ({ source, page: 0, queue: [], hasMore: true, fetchedAt: null, error: null })) };
        selected = null; calculation = null; visible = [];
        await Promise.all(state.sources.map(fetchPage));
        return display();
      }
      if (command.action === 'more') {
        if (!state) return { action: 'notice', message: 'Hãy tìm sản phẩm trước.', aiCalls: ai.calls };
        if (!state.sources.some(entry => entry.queue.length)) {
          await Promise.all(state.sources.filter(entry => entry.hasMore || entry.error).map(fetchPage));
        }
        return display();
      }
      if (command.action === 'select') {
        const row = visible[command.index - 1];
        if (!row) return { action: 'notice', message: 'Chọn số dòng đang hiển thị, từ 1 đến 10.', aiCalls: ai.calls };
        selected = { ...row }; calculation = null;
        return { action: 'selected', selected, message: 'Đã chọn sản phẩm; nhập lại tham số tính giá cho sản phẩm này.', aiCalls: ai.calls };
      }
      if (command.action === 'calculate') {
        calculation = calculateTargetPrice(command.parameters);
        return { action: 'calculated', calculation, message: 'Giá theo mục tiêu nhập; chưa phải kết luận về giá thị trường.', aiCalls: ai.calls };
      }
      if (!selected || !calculation) return { action: 'notice', message: 'Cần chọn sản phẩm và nhập tham số tính giá trước.', aiCalls: ai.calls };
      const result = await ai.analyze(selected, calculation);
      return { action: 'analysis', message: result.message || 'Đã nhận kết quả phân tích.', status: result.status, aiCalls: ai.calls };
    },
  };
}

module.exports = { createChatSession };
