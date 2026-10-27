import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/database';

describe('PostgreSQL Atomic Idempotency Tests', () => {
  let authToken = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'demo@nexuspay.dev',
      password: 'Password@123',
    });
    authToken = res.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('replays cached response when identical idempotency key is submitted', async () => {
    const key = `idem_test_${Date.now()}`;

    // First request
    const res1 = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send({
        amount: 250000, // ₹2,500.00
        currency: 'INR',
        description: 'Test order item',
      });

    expect(res1.status).toBe(201);
    const intentId1 = res1.body.data.intentId;

    // Second request with SAME key and SAME payload
    const res2 = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send({
        amount: 250000,
        currency: 'INR',
        description: 'Test order item',
      });

    expect(res2.status).toBe(201);
    expect(res2.headers['x-idempotency-replay']).toBe('true');
    expect(res2.body.data.intentId).toBe(intentId1);
  });

  it('rejects reuse of an idempotency key with an altered amount', async () => {
    const key = `idem_mismatch_${Date.now()}`;

    // Original request
    await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send({
        amount: 10000,
        currency: 'INR',
      });

    // Reused key with DIFFERENT amount
    const resMismatch = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send({
        amount: 999999, // Tampered amount
        currency: 'INR',
      });

    expect(resMismatch.status).toBe(400);
    expect(resMismatch.body.error.message).toContain('different request payload');
  });
});
