import {defineConfig} from '@playwright/test';
export default defineConfig({testMatch:'*.unit.spec.ts',workers:1});
