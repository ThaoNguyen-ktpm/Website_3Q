import { Router } from 'express';
import { getProducts } from '../controllers/productController.js';

const productRouter = Router();
productRouter.get('/', getProducts);

export { productRouter };
