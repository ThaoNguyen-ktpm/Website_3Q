import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export class Store {
  constructor(path) { this.path = path; }
  async read() {
    try {
      const state = JSON.parse(await readFile(this.path, 'utf8'));
      if (state.version !== 1 || !Array.isArray(state.products) || !Array.isArray(state.runs)) throw new Error('Cấu trúc dữ liệu không hợp lệ');
      return state;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async write(state, { stableRuns=false } = {}) {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${randomUUID()}.tmp`;
    // Runs are immutable during a live-update checkpoint. Serialize their large
    // historical payload once per draft; ordinary writes never use this cache.
    let json;
    if(stableRuns) {
      if(this.runsCache?.ref!==state.runs)this.runsCache={ref:state.runs,json:JSON.stringify(state.runs)};
      const rest=JSON.stringify({...state,runs:undefined});
      json=rest.slice(0,-1)+',"runs":'+this.runsCache.json+'}';
    } else {this.runsCache=null;json=JSON.stringify(state);}
    await writeFile(temp, json, 'utf8');
    await rename(temp, this.path);
  }
}
