import React, { useEffect, useRef, useState } from 'react';
import { askAssistant } from '../../api/assistant';
import Icon from './Icon';

// The reply already lists the details; show one short provenance line instead of repeating every item as a chip.
const sourceNames = { price: 'công thức tính giá BossTele', guide: 'hướng dẫn sử dụng', staff: 'danh sách nhân viên', audit: 'nhật ký thao tác' };
function sourceSummary(sources) {
  const count = kind => sources.filter(source => source.kind === kind).length;
  const parts = [];
  const products = sources.filter(source => source.kind === 'product');
  if (products.length === 1) parts.push(`KiotViet · ${products[0].label.split(' · ')[0]}`);
  else if (products.length) parts.push(`KiotViet · ${products.length} sản phẩm`);
  if (count('document')) parts.push(`${count('document')} đoạn tài liệu`);
  for (const [kind, name] of Object.entries(sourceNames)) if (count(kind)) parts.push(name);
  return parts.join(', ');
}

const vnd = value => value == null ? 'Chưa có giá' : `${value.toLocaleString('vi-VN')}đ`;
function ProductCard({ product }) {
  const [broken, setBroken] = useState(false);
  // Bảo 2026-10-20: a customer's deposit (Kiot đặt hàng) holds the item.
  const stock = product.onHand == null ? ['Không quản lý tồn', ''] : product.onHand <= 0 ? ['Hết hàng', 'is-out']
    : product.reserved >= product.onHand ? ['Đang giữ cho khách', 'is-out'] : [`Còn ${product.onHand}${product.reserved ? ` · giữ ${product.reserved}` : ''}`, 'is-in'];
  return <li className="assistant-product">
    {product.image && !broken ? <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)}/> : <span className="assistant-product-thumb"><Icon name="box" size={18}/></span>}
    <div><strong title={product.name}>{product.name}</strong><small>{product.sku}</small>
      <span className="assistant-product-meta"><b>{vnd(product.price)}</b><em className={stock[1]}>{stock[0]}</em>{product.hotTrend && <em className="is-hot">Hot</em>}</span></div>
  </li>;
}

const suggestions = ['SP000094 còn hàng không?', 'Hàng hot trend có những món nào?', 'Thêm nhân viên ở đâu?'];
const timestamp = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export default function AssistantWidget({ state, setState, page, telegram = false }) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const input = useRef(null), launcher = useRef(null), transcript = useRef(null), request = useRef(null);
  function cancel() {
    request.current?.abort(); request.current = null; setPending(false);
  }
  function close() {
    cancel(); setState(current => ({ ...current, open: false })); launcher.current?.focus();
  }
  useEffect(() => {
    if (state.open) input.current?.focus();
    const escape = event => { if (event.key === 'Escape' && state.open) { event.preventDefault(); close(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [state.open]);
  useEffect(() => { cancel(); return () => request.current?.abort(); }, [page]);
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [state.messages, pending, state.open]);

  async function send(text = draft, retry = false) {
    const content = text.trim();
    if (!content || content.length > 2000 || request.current) return;
    const history = state.messages.filter(message => !message.error && !message.greeting);
    const messages = retry ? history : [...history, { role: 'user', content, time: timestamp() }];
    setState(current => ({ ...current, messages: retry ? current.messages.filter(message => !message.error) : [...current.messages.filter(message => !message.error), messages.at(-1)] }));
    setDraft(''); setPending(true);
    const abort = new AbortController(); request.current = abort;
    try {
      const result = await askAssistant(messages.map(({ role, content }) => ({ role, content: content.slice(0, 2000) })), abort.signal);
      if (!abort.signal.aborted) setState(current => ({ ...current, messages: [...current.messages, { role: 'assistant', content: result.reply, sources: result.sources, products: Array.isArray(result.products) ? result.products : [], suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(text => typeof text === 'string').slice(0, 3) : [], time: timestamp() }] }));
    } catch (error) {
      if (!abort.signal.aborted) setState(current => ({ ...current, messages: [...current.messages, { role: 'assistant', content: error.message, error: true, retry: content, time: timestamp() }] }));
    } finally {
      if (request.current === abort) { request.current = null; setPending(false); input.current?.focus(); }
    }
  }
  const last = state.messages.filter(message => !message.error && !message.greeting).at(-1);
  return <div className="assistant-widget">
    {state.open && <section className="assistant-panel" role="region" aria-label="Trợ lý BaoQ">
      <header className="assistant-header"><div><h2>Trợ lý BaoQ</h2></div><button type="button" className="icon-button" aria-label="Thu nhỏ trợ lý" onClick={close}><Icon name="close" size={20}/></button></header>
      <div className="assistant-transcript" ref={transcript} role="log" aria-live="polite" aria-relevant="additions text">
        {state.messages.map((message, index) => <div key={index} className={`assistant-message ${message.role === 'user' ? 'from-user' : 'from-bot'} ${message.error ? 'is-error' : ''}`}>
          <div className="assistant-text">{message.content.split(/\n+/).filter(line => line.trim()).map((line, i) => <p key={i}>{line}</p>)}</div>
          {!!message.suggestions?.length && <div className="assistant-suggestions assistant-fix">{message.suggestions.map(text => <button type="button" disabled={pending} key={text} onClick={() => send(text)}>{text}<Icon name="arrow" size={14}/></button>)}</div>}
          {!!message.products?.length && <ul className="assistant-products">{message.products.map(product => <ProductCard key={product.sku} product={product}/>)}</ul>}
          {!!message.sources?.length && <p className="assistant-sources">Nguồn: {sourceSummary(message.sources)}</p>}
          <time>{message.time}</time>
          {message.error && <button className="assistant-retry" type="button" disabled={pending} onClick={() => send(message.retry, true)}>Thử lại</button>}
        </div>)}
        {state.messages.length === 1 && <div className="assistant-suggestions">{suggestions.map(text => <button type="button" disabled={pending} key={text} onClick={() => send(text)}>{text}<Icon name="arrow" size={14}/></button>)}</div>}
        {pending && <p className="assistant-wait" role="status">Đang trả lời…</p>}
        {!pending && last?.role === 'user' && !state.messages.at(-1)?.error && <button className="assistant-retry" type="button" onClick={() => send(last.content, true)}>Tiếp tục câu hỏi</button>}
      </div>
      <form className="assistant-compose" onSubmit={event => { event.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="assistant-input">Câu hỏi cho Trợ lý BaoQ</label>
        <textarea id="assistant-input" ref={input} value={draft} maxLength={2000} rows={2} placeholder="Nhập câu hỏi…" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}/>
        <button type="submit" aria-label="Gửi câu hỏi" disabled={pending || !draft.trim()}><Icon name="arrow" size={20}/></button>
      </form>
    </section>}
    {/* Bảo 2026-10-21: only Admin accounts get the way into BossTele (the bot gives full rights). */}
    {telegram && !state.open && <a className="assistant-telegram" href="https://web.telegram.org/k/#@BaoQ_bot" target="_blank" rel="noopener noreferrer" aria-label="Hỏi BossTele trên Telegram" title="Hỏi BossTele trên Telegram">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.5 3.5-19 7.3 6.6 2.4 2.5 7.3 3.6-4.6 4.8 3.6Z"/><path d="m9.1 13.2 8.4-6.2"/></svg>
    </a>}
    <button ref={launcher} type="button" className="assistant-launcher" aria-label={state.open ? 'Đóng trợ lý' : 'Mở trợ lý'} aria-expanded={state.open} onClick={() => state.open ? close() : setState(current => ({ ...current, open: true }))}>
      {state.open ? <Icon name="close" size={20}/> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/></svg>}
    </button>
  </div>;
}
