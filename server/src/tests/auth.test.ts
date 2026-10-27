import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/database';

describe('Auth & Session Rotation Tests', () => {
  const testEmail = `test_${Date.now()}@nexuspay.dev`;
  let refreshToken = '';

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a new merchant and receives tokens and default test API key', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Fintech Lab Pvt Ltd',
        email: testEmail,
        password: 'Password@123',
        currency: 'INR',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.initialApiKey).toMatch(/^npay_test_/);

    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('rejects duplicate registration with identical email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Another Business',
        email: testEmail,
        password: 'Password@123',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rotates refresh token and returns new token pair', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('detects refresh token reuse and immediately revokes token family', async () => {
    // Attempting to reuse the PREVIOUS (already rotated) token
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('Refresh token reuse detected');
  });
});
