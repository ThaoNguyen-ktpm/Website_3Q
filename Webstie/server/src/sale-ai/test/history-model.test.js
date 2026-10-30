import test from 'node:test';
import assert from 'node:assert/strict';
import {historyEntries,failedItems} from '../public/history-model.js';
test('combined history keeps simulations and writes distinct and newest first; errors exclude verified successes',()=>{
  const items=[{code:'OK',status:'done'},{code:'FAILED',status:'price_pending'},{code:'UNKNOWN',status:'unknown'},{code:'CONFLICT',status:'conflict'}];
  const state={runs:[{id:'sim',at:'2027-01-20T12:00:00Z',day:'2027-01-20',rows:[]}],updates:[{id:'write',at:'2027-01-20T13:00:00Z',items}]};
  const original=structuredClone(state);const rows=historyEntries(state);assert.deepEqual(rows.map(r=>r.id),['write','sim']);assert.equal(rows[0].day,'2027-01-20');assert.deepEqual(failedItems(items).map(r=>r.code),['FAILED','UNKNOWN','CONFLICT']);assert.deepEqual(state,original);assert.equal(historyEntries(state,false).length,1);
});
