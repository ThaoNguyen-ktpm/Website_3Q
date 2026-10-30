import {defineConfig} from 'vite';
// TASK-110: the only web UI, reachable from the shop wifi.
const api='http://127.0.0.1:4000';
// Retain the retired UI's security headers on the remaining entry point.
const csp="default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleusercontent.com https://cdn2-retail-images.kiotviet.vn https://cdn1-retail-images.kiotviet.vn https://cdn-images.kiotviet.vn https://bizweb.dktcdn.net; media-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; frame-src 'self' https://accounts.google.com/gsi/; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const headers={'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'};
export default defineConfig({server:{host:true,port:8787,strictPort:true,headers:{...headers,'Content-Security-Policy':csp.replace("connect-src 'self'","connect-src 'self' ws:")},proxy:{'/api':api,'/sale-ai':api}},preview:{headers}});
