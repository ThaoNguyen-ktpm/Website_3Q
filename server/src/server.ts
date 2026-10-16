import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';
import { startRetention } from './services/auditService.js';

app.listen(env.PORT, () => {
  startRetention(env.AUDIT_RETENTION_DAYS);
  console.log(`API đang chạy tại http://localhost:${env.PORT}`);
});
