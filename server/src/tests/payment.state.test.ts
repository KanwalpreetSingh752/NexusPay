import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/database';

describe('Payment State Machine & Refund Safety Tests', () => {
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

  it('rejects tampered or forged payment signatures', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        razorpayOrderId: 'order_fake123',
        razorpayPaymentId: 'pay_fake456',
        razorpaySignature: 'forged_signature_0000',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('signature');
  });

  it('creates intent, settles with simulated signature, and enforces refund cap', async () => {
    // 1. Create Payment Intent for ₹500 (50000 paise)
    const createRes = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 50000,
        currency: 'INR',
        description: 'Test Placement Payment',
      });

    expect(createRes.status).toBe(201);
    const { intentId, providerOrderId } = createRes.body.data;
    expect(providerOrderId).toBeDefined();

    // 2. Verify and Settle Payment
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        razorpayOrderId: providerOrderId,
        razorpayPaymentId: `pay_${Date.now()}`,
        razorpaySignature: 'simulated_valid_signature',
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('SUCCEEDED');

    // 3. Verify Journal Entry was created
    const journalEntries = await prisma.transactionJournalEntry.findMany({
      where: { paymentIntentId: intentId },
    });
    expect(journalEntries.length).toBe(1);
    expect(journalEntries[0].entryType).toBe('PAYMENT_CAPTURE');
    expect(journalEntries[0].grossAmount.toString()).toBe('50000');

    // 4. Execute Partial Refund for ₹300 (30000 paise)
    const refund1Res = await request(app)
      .post(`/api/v1/payments/${intentId}/refunds`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 30000,
        reason: 'Customer return',
      });

    expect(refund1Res.status).toBe(200);
    expect(refund1Res.body.data.intentStatus).toBe('PARTIALLY_REFUNDED');

    // 5. Attempt another refund for ₹300 (30000 paise) -> Total would be ₹600, exceeding ₹500!
    const refundExcessRes = await request(app)
      .post(`/api/v1/payments/${intentId}/refunds`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 30000,
      });

    expect(refundExcessRes.status).toBe(400);
    expect(refundExcessRes.body.error.message).toContain('exceeds refundable balance');

    // 6. Complete remaining ₹200 (20000 paise) refund
    const refund2Res = await request(app)
      .post(`/api/v1/payments/${intentId}/refunds`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 20000,
      });

    expect(refund2Res.status).toBe(200);
    expect(refund2Res.body.data.intentStatus).toBe('REFUNDED');
  });
});
