import {cp} from 'node:fs/promises';
await cp(new URL('../src/v2/mockup/',import.meta.url),new URL('../dist/v2/mockup/',import.meta.url),{recursive:true});
