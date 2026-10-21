// Run: node --experimental-transform-types tasks/TASK-028-ui-selfcheck.mjs
// Offline JSX/SSR + API contract checks; does not replace desktop/mobile browser QA.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/client/')) {
      for (const suffix of ['', '.ts', '.jsx']) {
        const candidate = new URL(specifier + suffix, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.jsx') && url.includes('/client/')) {
      const result = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
      assert.equal(result.diagnostics?.length ?? 0, 0);
      return { format: 'module', source: result.outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});
const { default: Widget } = await import('../client/src/admin/components/AssistantWidget.jsx');
const { askAssistant } = await import('../client/src/api/assistant.ts');
const greeting = { role: 'assistant', greeting: true, content: 'Chào bạn, mình có thể giúp gì cho bạn?', time: '10:00' };
const render = (open, messages = [greeting]) => renderToStaticMarkup(React.createElement(Widget, { state: { open, messages }, setState() {}, page: 'overview' }));
const closed = render(false);
assert.ok(closed.includes('aria-label="Mở trợ lý"')); assert.ok(!closed.includes('assistant-panel'));
const opened = render(true);
for (const label of ['Trợ lý BaoQ', greeting.content, 'SP000094 còn hàng không?', 'Hàng hot trend có những món nào?', 'Thêm nhân viên ở đâu?', 'aria-live="polite"', 'Gửi câu hỏi', 'Thu nhỏ trợ lý']) assert.ok(opened.includes(label), label);
const escaped = render(true, [greeting, { role: 'user', content: 'câu hỏi', time: '10:01' }, { role: 'assistant', content: '<img src=x onerror=alert(1)>\nDòng hai', time: '10:02', sources: [{ kind: 'product', label: '<script>bad</script>' }] }]);
assert.ok(escaped.includes('&lt;img')); assert.ok(!escaped.includes('<img')); assert.ok(!escaped.includes('<script>')); assert.ok(escaped.includes('assistant-sources')); assert.ok(escaped.includes('from-user'));
assert.ok(render(true, [{ role: 'assistant', error: true, content: 'Lỗi kiểm thử', retry: 'x', time: '10:00' }]).includes('Thử lại'));
const originalFetch = globalThis.fetch;
let payload;
globalThis.fetch = async (url, init) => {
  assert.equal(url, '/api/assistant/chat'); payload = init;
  return new Response(JSON.stringify({ reply: 'Trả lời kiểm thử', offTopic: false, sources: [] }));
};
try {
  const abort = new AbortController();
  assert.equal((await askAssistant(Array.from({ length: 14 }, (_, index) => ({ role: 'user', content: String(index) })), abort.signal)).reply, 'Trả lời kiểm thử');
  assert.equal(payload.signal, abort.signal); assert.equal(payload.credentials, 'include'); assert.equal(payload.cache, 'no-store');
  assert.equal(JSON.parse(payload.body).messages.length, 10); assert.equal(JSON.parse(payload.body).messages[0].content, '4');
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Mô hình đang bận.' } }), { status: 503 });
  await assert.rejects(askAssistant([{ role: 'user', content: 'x' }]), { message: 'Mô hình đang bận.' });
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(askAssistant([{ role: 'user', content: 'x' }]), /Phản hồi trợ lý không hợp lệ/);
  console.log('PASS: real widget JSX/SSR, greeting/suggestions, source chips, escaped text, retry UI; API last10/credentials/abort-signal/error handling. No browser/network/DB.');
} finally { globalThis.fetch = originalFetch; }
