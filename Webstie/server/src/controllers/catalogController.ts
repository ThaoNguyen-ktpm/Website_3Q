import type { RequestHandler } from 'express';
import { parseCatalogQuery, searchCatalog } from '../services/catalogSearchService.js';
import { catalogStore, parseProductsQuery } from '../services/catalogStore.js';

export const getCatalogSearch: RequestHandler = async (request, response, next) => {
  try {
    const query = parseCatalogQuery(request.query);
    response.set('Cache-Control', 'no-store');
    response.json(await searchCatalog(query, response.locals.user.permissions.includes('products.cost')));
  } catch (error) { next(error); }
};

export const getCatalogProducts: RequestHandler = async (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  try {
    const query = parseProductsQuery(request.query);
    response.json(await catalogStore.products(query, response.locals.user.permissions.includes('products.cost')));
  } catch (error) { next(error); }
};

export const syncCatalogProducts: RequestHandler = async (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  try { response.json(await catalogStore.forceSync()); }
  catch (error) { next(error); }
};
