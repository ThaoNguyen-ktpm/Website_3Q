import {defineConfig} from '@playwright/test';
export default defineConfig({
 testMatch:'task041.spec.ts',
 fullyParallel:true,
 workers:2,
 use:{channel:'chrome',baseURL:'http://127.0.0.1:8791',headless:true,viewport:{width:1440,height:1000}},
 webServer:{command:'npm.cmd run dev -- --host 127.0.0.1 --port 8791',url:'http://127.0.0.1:8791',reuseExistingServer:false},
});
