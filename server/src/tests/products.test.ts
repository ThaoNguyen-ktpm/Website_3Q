import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { findProducts } from '../models/productModel.js';

vi.mock('../models/productModel.js', () => ({ findProducts: vi.fn() }));

describe('GET /api/products', () => {
  beforeEach(() => vi.mocked(findProducts).mockReset());

  it('trả tên, giá VND và danh mục có dấu tiếng Việt', async () => {
    vi.mocked(findProducts).mockResolvedValue([
      { id: 1, name: 'Túi tote vải mẫu', priceVnd: 185000, category: { name: 'Túi xách' } },
    ]);

    const response = await request(app).get('/api/products');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      products: [{ id: 1, name: 'Túi tote vải mẫu', priceVnd: 185000, category: 'Túi xách' }],
    });
  });

});
