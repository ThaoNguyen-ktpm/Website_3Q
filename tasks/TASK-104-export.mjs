import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = 'D:/BaoQ-AI';
const directory = join(root, 'data/kiot-state.store');
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
async function blob(digest) {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw Error('Invalid reference');
  const bytes = await readFile(join(directory, 'blobs', digest + '.json'));
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('Hash mismatch');
  return JSON.parse(bytes);
}
const result = {};
for (const key of ['updates', 'prepared']) {
  result[key] = await Promise.all((await blob(manifest.indexes[key])).map(blob));
}
const output = join(root, 'lich-su-cap-nhat-2026-10-29.json');
const text = JSON.stringify(result, null, 2);
if (/"(?:access_token|client_secret|api_key|api_secret|authorization)"\s*:/i.test(text)) throw Error('Secret field detected; export refused');
await writeFile(output, text, { flag: 'wx' });
const saved = await readFile(output);
if (!saved.equals(Buffer.from(text))) throw Error('Export verification failed');
console.log(JSON.stringify({ output, updates: result.updates.length, prepared: result.prepared.length, bytes: saved.length, sha256: createHash('sha256').update(saved).digest('hex') }));
