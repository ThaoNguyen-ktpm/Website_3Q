import { createSaleAi } from './core.js';
import { KiotClient } from './lib/kiot.js';
import { SapoClient } from './lib/sapo.js';
import { loadConnectionConfig } from '../config/shared.js';
import { waitForStoreLocks } from './lib/store-lock.js';

let current: Awaited<ReturnType<typeof createSaleAi>> | undefined;
let starting: Promise<void> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let checkTimer: ReturnType<typeof setInterval> | undefined;
let stopping = false;
let failing = false;
let unavailableReason = 'Sale AI đang khởi động — vui lòng thử lại.';
const secrets = new Set<string>();
export const getSaleAi = () => current;
export const getSaleAiUnavailableReason = () => unavailableReason;

async function initializeSaleAi() {
    // Use the same authoritative project configuration as catalog search; never mix or log credentials.
    const { kiotviet, sapoWeb } = loadConnectionConfig();
    for (const value of [kiotviet.clientId, kiotviet.clientSecret, sapoWeb.apiKey, sapoWeb.apiSecret]) if (value) secrets.add(value);
    const client = new KiotClient({ credentials: {
      retailer: kiotviet.retailer, client: kiotviet.clientId, secret: kiotviet.clientSecret,
    } });
    // Keep every Sale AI Kiot read on the native transport, including full refreshes.
    return createSaleAi({ client, batchWrites:true, sapoWrite:false, kiotDescription:false, sapoClient: new SapoClient({shop: sapoWeb.domain, key: sapoWeb.apiKey, secret: sapoWeb.apiSecret}) });
}

function safeReason(error: unknown): string {
  let reason = error instanceof Error ? error.message : 'Lỗi khởi tạo không xác định';
  for (const [key, value] of Object.entries(process.env)) if (/secret|token|password|api.?key|client.?id/i.test(key) && value) secrets.add(value);
  for (const value of secrets) reason = reason.split(value).join('[ẩn]');
  return reason.replace(/https?:\/\/\S+/gi, '[URL ẩn]')
    .replace(/(authorization|secret|token|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[ẩn]').split(/[\r\n]/)[0].slice(0, 500);
}

/** A fatal process error cannot safely resume; persist conservative journal recovery, then exit. */
export async function failSaleAi(error: unknown, exit: (code: number) => void = code => process.exit(code), timeoutMs = 5000): Promise<void> {
  if (failing) return;
  failing = true;
  stopping = true;clearTimeout(retryTimer);clearInterval(checkTimer);
  unavailableReason = 'Sale AI bị gián đoạn — xem Lịch sử sau khi máy chủ chạy lại.';
  console.error(`Sale AI: lỗi nghiêm trọng, đang phục hồi nhật ký rồi thoát: ${safeReason(error)}`);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<void>(resolve => { deadline = setTimeout(() => { console.error('Sale AI: hết thời gian phục hồi; kiểm tra nhật ký khi khởi động lại.');resolve(); }, timeoutMs); });
  try { await Promise.race([current?.interrupt(), expired]); }
  catch (recoveryError) { console.error(`Sale AI: không lưu được lượt gián đoạn: ${safeReason(recoveryError)}`); }
  finally { clearTimeout(deadline);exit(1); }
}

/** Start after listen; one attempt at a time, retry without holding up the web port. */
export function startSaleAi(initialize = initializeSaleAi): Promise<void> {
  if (stopping || current) return Promise.resolve();
  if (starting) return starting;
  clearTimeout(retryTimer);retryTimer = undefined;
  starting = Promise.resolve().then(async () => {
    try {
      const core = await initialize();
      if (stopping) { await core.shutdown(); return; }
      current = core;unavailableReason = '';
      const check = async () => { try { await core.checkAutoUpdate();await core.keepCurrent(); } catch (error) { console.error(`Sale AI: không thể cập nhật bảng hôm nay: ${safeReason(error)}`); } };
      await check();
      if (!stopping) checkTimer = setInterval(() => { void check(); }, 15_000).unref();
    } catch (error) {
      const reason = safeReason(error);
      console.error(`Sale AI: khởi tạo thất bại: ${reason}`);
      unavailableReason = /Store busy|lock exists|EEXIST.*lock/i.test(reason)
        ? 'Kho Sale AI đang bị khoá — đang thử lại sau 15 giây.'
        : 'Sale AI chưa khởi tạo được kho hoặc cấu hình — đang thử lại sau 15 giây.';
      if (!stopping) retryTimer = setTimeout(() => { void startSaleAi(initialize); }, 15_000).unref();
    } finally { starting = undefined; }
  });
  return starting;
}

/** Called only by server shutdown; bounded wait, never force-release an active writer. */
export async function stopSaleAi(timeoutMs = 5000): Promise<boolean> {
  stopping = true;clearTimeout(retryTimer);clearInterval(checkTimer);
  const deadline = Date.now() + timeoutMs;
  const stopped = current ? await current.shutdown({timeoutMs}) : true;
  const released = await waitForStoreLocks(Math.max(0, deadline - Date.now()));
  return stopped && released && !starting;
}
