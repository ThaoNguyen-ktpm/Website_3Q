import { expect, it } from 'vitest';
import { extractSkus, matchingSkus, skuChoice } from '../services/assistant/sku.js';

it('extracts complete uppercase codes, excluding embedded and short codes', () => {
  expect(extractSkus('sp025211_kg SP025306_29102026 (SP000009) XSP025211_KG SP025211KG SP123'))
    .toEqual(['SP025211_KG', 'SP025306_29102026', 'SP000009']);
});

it('prefers an exact code and never substitutes another suffix', () => {
  const items = ['SP025211_KG', 'SP025211_29102026', 'SP0252110_KG'].map(sku => ({ sku }));
  expect(matchingSkus(items, 'sp025211_kg')).toEqual([items[0]]);
  expect(matchingSkus(items, 'SP025211')).toEqual(items.slice(0, 2));
  expect(matchingSkus(items, 'SP025211_OTHER')).toEqual([]);
  expect(matchingSkus([...items, { sku: 'SP025211' }], 'SP025211')).toEqual([{ sku: 'SP025211' }]);
});

it('limits ambiguous choices to five full codes', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ sku: `SP024387_KG${i}` }));
  const reply = skuChoice(items);
  expect(extractSkus(reply)).toEqual(['SP024387_KG0', 'SP024387_KG1', 'SP024387_KG2', 'SP024387_KG3', 'SP024387_KG4']);
});
