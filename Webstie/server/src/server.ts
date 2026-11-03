import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';
import { startRetention } from './services/auditService.js';
import { catalogStore } from './services/catalogStore.js';
import { startSaleAi, stopSaleAi, failSaleAi } from './sale-ai/runtime.js';

const server=app.listen(env.PORT, () => {
  startRetention(env.AUDIT_RETENTION_DAYS);
  // Load the KiotViet catalog now so the search page and assistant never wait for the first sync.
  void catalogStore.sync();
  void startSaleAi();
  console.log(`API đang chạy tại http://localhost:${env.PORT}`);
});
// Sale AI work is accepted in short requests and runs independently of HTTP.
server.requestTimeout=30_000;
server.headersTimeout=15_000;
server.setTimeout(30_000);
let stopping = false;
process.on('uncaughtException', error => { void failSaleAi(error); });
process.on('unhandledRejection', error => { void failSaleAi(error); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  server.close();
  void stopSaleAi(5000).then(clean => {
    if (!clean) console.warn('Sale AI: hết thời gian tắt êm; khoá còn lại được kiểm tra PID khi khởi tạo lại.');
    process.exit(0);
  }).catch(() => { console.error('Sale AI: không thể hoàn tất tắt êm.');process.exit(1); });
});
