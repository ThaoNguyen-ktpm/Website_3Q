import type { RequestHandler } from 'express';
import { findProducts } from '../models/productModel.js';

export const getProducts: RequestHandler = async (_request, response, next) => {
  try {
    const products = await findProducts();
    response.json({
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        priceVnd: product.priceVnd,
        category: product.category.name,
      })),
    });
  } catch (error) {
    next(error);
  }
};
