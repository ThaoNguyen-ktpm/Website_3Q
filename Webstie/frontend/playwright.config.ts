import {defineConfig} from '@playwright/test';
export default defineConfig({testMatch:'qa.spec.ts',use:{channel:'chromium',viewport:{width:1440,height:1000}},timeout:30000});
