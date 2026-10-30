import http from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after} from 'node:test';
import {createSaleAi} from '../core.js';
import {SampleSource} from '../lib/samples.js';
import {KiotClient} from '../lib/kiot.js';
import {SapoClient} from '../lib/sapo.js';

const memory=()=>{let value=null;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
const forbidden=async()=>{throw Error('Unexpected external call in HTTP fixture');};

// Only the HTTP transport and isolated dependencies live here; all routes use the real core.
export async function createTestApp(options={}) {
  const adapter=options.client instanceof KiotClient;
  const dataDir=adapter?await mkdtemp(join(tmpdir(),'sale-http-')):undefined;
  if(dataDir)after(()=>rm(dataDir,{recursive:true,force:true}));
  const sale=await createSaleAi({
    source:new SampleSource(),store:memory(),liveStore:memory(),sapoStore:memory(),
    client:{all:forbidden,product:forbidden,update:forbidden},
    sapoClient:adapter?new SapoClient({shop:'',key:'',secret:''},forbidden):{configured:false,all:forbidden,product:forbidden,update:forbidden,restore:forbidden},
    ...options,fixture:!adapter,dataDir,
  });
  return {...sale,server:http.createServer(sale.handler)};
}
