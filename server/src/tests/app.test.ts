import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('API', () => {
  it('GET /api/health trả trạng thái ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('trả lỗi thống nhất cho đường dẫn không tồn tại', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn.' },
    });
  });

  it('trả lỗi thống nhất khi JSON không hợp lệ', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'JSON không hợp lệ.' },
    });
  });
});
