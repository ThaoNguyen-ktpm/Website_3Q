import { Router } from 'express';
import { getCatalogSearch, getCatalogProducts, syncCatalogProducts } from '../controllers/catalogController.js';

export const catalogRouter = Router();
catalogRouter.get('/search', getCatalogSearch);
catalogRouter.get('/products', getCatalogProducts);
catalogRouter.post('/sync', syncCatalogProducts);
