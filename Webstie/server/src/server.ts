import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';
import { startRetention } from './services/auditService.js';
import { catalogStore } from './services/catalogStore.js';

app.listen(env.PORT, () => {
  startRetention(env.AUDIT_RETENTION_DAYS);
  // Load the KiotViet catalog now so the search page and assistant never wait for the first sync.
  void catalogStore.sync();
  console.log(`API đang chạy tại http://localhost:${env.PORT}`);
});
