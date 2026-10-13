import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from '../middlewares/errorHandler.js';
import { listProducts } from '../services/productService.js';

const productQuerySchema = z.object({
  category: z.string().trim().min(1).max(191).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
}).strict();

export const getProducts: RequestHandler = async (request, response, next) => {
  try {
    const query = productQuerySchema.safeParse(request.query);
    if (!query.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Tham số lọc sản phẩm không hợp lệ.');
    const products = await listProducts(query.data.category);
    response.json({ products });
  } catch (error) {
    next(error);
  }
};
