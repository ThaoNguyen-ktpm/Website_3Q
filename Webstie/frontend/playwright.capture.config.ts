import {defineConfig} from '@playwright/test';
// Visual capture only (baseline/after screenshots). Run with BAOQ_SHOTS=<folder name under docs/qa>.
export default defineConfig({testMatch:'visual-capture.spec.ts',use:{channel:'chromium',viewport:{width:1440,height:1000}},timeout:60000,workers:1});
