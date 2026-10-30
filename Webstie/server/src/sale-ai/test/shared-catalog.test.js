import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct } from '../lib/kiot.js';
import { rawFromWebRow } from '../lib/shared-catalog.js';

const webRow = (id, onHand, extra = {}) => ({ source: 'kiotviet', productId: id, sku: `SP${id}`, name: 'Túi Chanel Full', price: 5000000, onHand,
  detail: { name: 'Túi Chanel', fullName: 'Túi Chanel Full', createdDate: '2026-10-01T09:00:00', isActive: true, description: '<p>Ghi chú</p>',
    modifiedDate: '2026-10-02T09:00:00', categoryId: 7, taxPresent: false, inventories: [{ branchId: 44466, onHand }, { branchId: 9, onHand: 5 }], ...extra } });
const kiotRaw = (id, onHand) => ({ id, code: `SP${id}`, name: 'Túi Chanel', fullName: 'Túi Chanel Full', basePrice: 5000000, createdDate: '2026-10-01T09:00:00',
  isActive: true, description: '<p>Ghi chú</p>', modifiedDate: '2026-10-02T09:00:00', categoryId: 7, inventories: [{ branchId: 44466, onHand }] });

test('a website row normalizes exactly like the same product read from Kiot', () => {
  const { rawSource: _web, ...fromWeb } = normalizeProduct(rawFromWebRow(webRow(1, 2)));
  const { rawSource: _kiot, ...fromKiot } = normalizeProduct(kiotRaw(1, 2));
  assert.deepEqual(fromWeb, fromKiot);
  assert.equal(normalizeProduct(rawFromWebRow(webRow(2, 1, { taxPresent: true }))).taxPresent, true);
});
