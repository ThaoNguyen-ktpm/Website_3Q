import { computeBirkinFields, type BirkinFieldRequest } from './birkinTextures';

self.onmessage = async (e: MessageEvent<BirkinFieldRequest>) => {
  const fields = await computeBirkinFields(e.data);
  const maps = [fields.body, fields.handle, fields.strap, fields.tile];
  const transfer = maps.flatMap((f) => [f.albedo.buffer, f.normal.buffer, f.roughness.buffer]);
  (self as unknown as Worker).postMessage(fields, transfer as ArrayBuffer[]);
};
