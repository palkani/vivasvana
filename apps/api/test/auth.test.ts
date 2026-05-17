import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.js';

const app = await createTestApp();
afterAll(async () => app.close());

describe('auth middleware', () => {
  it('returns 401 on admin route without bearer token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/products' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on admin route with invalid bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products',
      headers: { authorization: 'Bearer not.a.real.jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows public routes without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(200);
  });

  it('exposes /health without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
