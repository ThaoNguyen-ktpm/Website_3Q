// @ts-check
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {import('../services/catalogSearchService.js').CatalogSource} CatalogSource
 * @typedef {import('../services/catalogSearchService.js').CatalogResult} CatalogResult
 * @typedef {{ kiotviet: { retailer: string, clientId: string, clientSecret: string }, sapoWeb: { domain: string, authType: string, apiKey: string, apiSecret: string, accessToken: string } }} ConnectionConfig
 * @typedef {{ source: CatalogSource, kind: 'name' | 'sku', query: string, page: number, startPage: number, detail: true }} SearchOptions
 * @typedef {{ capital: string, expenses: string, method: string, rate: string }} PriceInput
 * @typedef {PriceInput & { cost: string, sellingPrice: string, formula: string }} PriceCalculation
 */

// src/config and dist/config resolve the same shared modules and authoritative .env directory.
const require = createRequire(import.meta.url);
const sharedRoot = fileURLToPath(new URL('../../../shared/', import.meta.url));
const configRoot = fileURLToPath(new URL('../../../BossTele/', import.meta.url));
/** @type {{ loadConnectionConfig: (root: string) => ConnectionConfig }} */
const connection = require(`${sharedRoot}/connection-config.js`);
export const loadConnectionConfig = () => connection.loadConnectionConfig(configRoot);
/** @type {{ createProductSearch: (config: unknown) => (options: SearchOptions) => Promise<CatalogResult[]>, createCatalogFetcher: (config: unknown) => (source: CatalogSource) => Promise<CatalogResult> }} */
export const { createProductSearch, createCatalogFetcher } = require(`${sharedRoot}/product-search.js`);
/** @type {{ calculateTargetPrice: (input: PriceInput) => PriceCalculation }} */
export const { calculateTargetPrice } = require(`${sharedRoot}/target-price.js`);
/** @type {{ fold: (text: unknown) => string }} */
export const { fold } = require(`${sharedRoot}/text.js`);
/** @type {{ extractSkus: (text: string) => string[], matchingSkus: <T extends { sku: string }>(items: T[], sku: string) => T[], skuChoice: (items: { sku: string }[]) => string }} */
export const { extractSkus, matchingSkus, skuChoice } = require(`${sharedRoot}/sku.js`);
/** @type {{ vnd: (value: number) => string, tr: (value: number) => string }} */
export const { vnd, tr } = require(`${sharedRoot}/money.js`);
