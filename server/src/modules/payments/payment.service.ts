import { prisma } from '../../config/database';
import { razorpayWrapper } from '../../integrations/razorpay/razorpay.client';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import {
  CreatePaymentIntentInput,
  VerifyPaymentInput,
  RefundPaymentInput,
  ListPaymentsQuery,
} from './payment.schema';

export class PaymentService {
  /**
   * Step 1: Create an internal PaymentIntent and initiate an initial PaymentAttempt
   * interacting cleanly with Razorpay orders API.
   */
  async createPaymentIntent(merchantId: string, input: CreatePaymentIntentInput) {
    const currency = (input.currency || 'INR').toUpperCase();

    // 1. Transactionally persist PaymentIntent & Attempt in DB
    const { intent, attempt } = await prisma.$transaction(async (tx) => {
      // Merge customer context into metadata for enriched audit trail
      const enrichedMetadata = {
        ...(input.metadata || {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
        ...(input.customerName ? { customerName: input.customerName } : {}),
      };

      const newIntent = await tx.paymentIntent.create({
        data: {
          merchantId,
          amount: BigInt(input.amount),
          currency,
          description: input.description,
          metadata: enrichedMetadata,
          status: 'REQUIRES_PAYMENT',
        },
      });

      const initialAttempt = await tx.paymentAttempt.create({
        data: {
          paymentIntentId: newIntent.id,
          attemptNumber: 1,
          status: 'INITIATED',
          provider: 'razorpay',
        },
      });

      return { intent: newIntent, attempt: initialAttempt };
    });

    // 2. Cross-system interaction with Razorpay orders API
    try {
      const rzpOrder = await razorpayWrapper.createOrder({
        amount: input.amount,
        currency,
        receipt: attempt.id, // Stable internal attempt ID as receipt reference
        notes: {
          paymentIntentId: intent.id,
          attemptId: attempt.id,
          merchantId,
        },
      });

      // 3. Atomically advance status to PROCESSING with providerOrderId recorded
      await prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            providerOrderId: rzpOrder.id,
            status: 'PENDING_PROVIDER',
          },
        });

        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: 'PROCESSING' },
        });
      });

      return {
        intentId: intent.id,
        attemptId: attempt.id,
        amount: input.amount,
        currency,
        status: 'PROCESSING',
        providerOrderId: rzpOrder.id,
        razorpayKeyId: config.razorpay.keyId,
      };
    } catch (err: any) {
      logger.error('Failed to create order with Razorpay:', err);

      // Distinguish network timeout from hard rejection
      const isTimeout = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET';
      const attemptStatus = isTimeout ? 'UNCERTAIN' : 'FAILED';

      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: attemptStatus,
          failureCode: err.code || 'PROVIDER_ERROR',
          failureMessage: err.message,
        },
      });

      if (!isTimeout) {
        await prisma.paymentIntent.update({
          where: { id: intent.id },
          data: { status: 'FAILED' },
        });
      }

      throw ApiError.badGateway(`Payment provider error: ${err.message}`);
    }
  }

  /**
   * Step 2: Authoritative Payment Verification & Settlement
   */
  async verifyPayment(merchantId: string, input: VerifyPaymentInput) {
    // 1. Verify cryptographic HMAC signature
    const isValidSignature = razorpayWrapper.verifyPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });

    if (!isValidSignature) {
      throw ApiError.badRequest('Invalid Razorpay payment cryptographic signature');
    }

    // 2. Find attempt matching providerOrderId and verify tenant ownership
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { providerOrderId: input.razorpayOrderId },
      include: { paymentIntent: true },
    });

    if (!attempt || attempt.paymentIntent.merchantId !== merchantId) {
      throw ApiError.notFound('No matching payment attempt found for this merchant');
    }

    const intent = attempt.paymentIntent;

    // 3. State guard: check if already settled (idempotent verification)
    if (intent.status === 'SUCCEEDED') {
      return {
        intentId: intent.id,
        status: 'SUCCEEDED',
        alreadySettled: true,
      };
    }

    if (intent.status === 'FAILED') {
      throw ApiError.conflict('Cannot verify payment: Intent is already marked FAILED');
    }

    // 4. Authoritative check with Razorpay API (do NOT trust client alone!)
    const rzpPayment = await razorpayWrapper.fetchPayment(input.razorpayPaymentId);

    if (rzpPayment.amount > 0 && BigInt(rzpPayment.amount) !== intent.amount) {
      logger.warn('Amount tampering detected on payment verification', {
        intentAmount: intent.amount.toString(),
        providerAmount: rzpPayment.amount,
      });
      throw ApiError.badRequest('Payment amount mismatch against provider record');
    }

    // 5. ATOMIC COMMIT: Intent state + Attempt state + Transaction Journal + Outbox Event
    const updatedIntent = await prisma.$transaction(async (tx) => {
      const settledIntent = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'SUCCEEDED',
          capturedAmount: intent.amount,
        },
      });

      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId: input.razorpayPaymentId,
          providerSignature: input.razorpaySignature,
          paymentMethod: rzpPayment.method,
        },
      });

      // Calculate sample 2% platform fee
      const gross = settledIntent.amount;
      const fee = BigInt(Math.floor(Number(gross) * 0.02));
      const net = gross - fee;

      // Append-only Transaction Journal Entry
      await tx.transactionJournalEntry.create({
        data: {
          merchantId,
          paymentIntentId: settledIntent.id,
          entryType: 'PAYMENT_CAPTURE',
          grossAmount: gross,
          feeAmount: fee,
          netAmount: net,
          currency: settledIntent.currency,
          description: `Payment captured: ${input.razorpayPaymentId}`,
        },
      });

      // Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'payment_intent',
          aggregateId: settledIntent.id,
          eventType: 'payment.succeeded',
          payload: {
            intentId: settledIntent.id,
            amount: settledIntent.amount.toString(),
            currency: settledIntent.currency,
            providerPaymentId: input.razorpayPaymentId,
            method: rzpPayment.method,
          },
        },
      });

      return settledIntent;
    });

    return {
      intentId: updatedIntent.id,
      status: 'SUCCEEDED',
      amount: updatedIntent.amount.toString(),
      currency: updatedIntent.currency,
      providerPaymentId: input.razorpayPaymentId,
    };
  }

  /**
   * Step 3: Concurrency-Safe Refund Processing
   */
  async processRefund(merchantId: string, intentId: string, input: RefundPaymentInput) {
    const refundAmount = BigInt(input.amount);

    return await prisma.$transaction(async (tx) => {
      // Pessimistic Row Lock on PaymentIntent
      const [intent] = await tx.$queryRaw<any[]>`
        SELECT id, merchant_id, amount, currency, status, captured_amount, refunded_amount
        FROM payment_intents
        WHERE id = ${intentId}::uuid AND merchant_id = ${merchantId}::uuid
        FOR UPDATE
      `;

      if (!intent) {
        throw ApiError.notFound('PaymentIntent not found');
      }

      if (intent.status !== 'SUCCEEDED' && intent.status !== 'PARTIALLY_REFUNDED') {
        throw ApiError.conflict(`Cannot refund intent in '${intent.status}' state`);
      }

      const captured = BigInt(intent.captured_amount);
      const alreadyRefunded = BigInt(intent.refunded_amount);
      const availableToRefund = captured - alreadyRefunded;

      if (refundAmount > availableToRefund) {
        throw ApiError.badRequest(
          `Refund amount (${refundAmount}) exceeds refundable balance (${availableToRefund})`
        );
      }

      // Find successful attempt for providerPaymentId
      const successAttempt = await tx.paymentAttempt.findFirst({
        where: { paymentIntentId: intentId, status: 'SUCCEEDED' },
      });

      if (!successAttempt || !successAttempt.providerPaymentId) {
        throw ApiError.conflict('No successful captured payment attempt found to refund');
      }

      // Record pending refund
      const refund = await tx.refund.create({
        data: {
          paymentIntentId: intentId,
          amount: refundAmount,
          currency: intent.currency,
          status: 'PENDING',
          reason: input.reason || 'merchant_requested',
        },
      });

      // Call Razorpay Refund API
      let rzpRefund;
      try {
        rzpRefund = await razorpayWrapper.createRefund(successAttempt.providerPaymentId, {
          amount: Number(refundAmount),
          notes: {
            refundId: refund.id,
            intentId,
          },
        });
      } catch (err: any) {
        await tx.refund.update({
          where: { id: refund.id },
          data: { status: 'FAILED', failureMessage: err.message },
        });
        throw ApiError.badGateway(`Razorpay refund failed: ${err.message}`);
      }

      const newRefundedTotal = alreadyRefunded + refundAmount;
      const nextStatus = newRefundedTotal >= captured ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'SUCCEEDED',
          providerRefundId: rzpRefund.id,
        },
      });

      await tx.paymentIntent.update({
        where: { id: intentId },
        data: {
          refundedAmount: newRefundedTotal,
          status: nextStatus,
        },
      });

      // Financial Journal entry for refund
      await tx.transactionJournalEntry.create({
        data: {
          merchantId,
          paymentIntentId: intentId,
          refundId: refund.id,
          entryType: nextStatus === 'REFUNDED' ? 'REFUND_FULL' : 'REFUND_PARTIAL',
          grossAmount: refundAmount,
          feeAmount: BigInt(0),
          netAmount: refundAmount,
          currency: intent.currency,
          description: `Refund processed: ${rzpRefund.id}`,
        },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'refund',
          aggregateId: refund.id,
          eventType: nextStatus === 'REFUNDED' ? 'refund.succeeded' : 'refund.partial',
          payload: {
            intentId,
            refundId: refund.id,
            amount: refundAmount.toString(),
            providerRefundId: rzpRefund.id,
          },
        },
      });

      return {
        refundId: refund.id,
        intentId,
        amount: refundAmount.toString(),
        status: 'SUCCEEDED',
        providerRefundId: rzpRefund.id,
        intentStatus: nextStatus,
      };
    });
  }

  /**
   * Step 4: Deterministic Cursor-based Pagination
   */
  async listPayments(merchantId: string, query: ListPaymentsQuery) {
    const limit = query.limit || 20;
    const where: any = { merchantId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.cursor) {
      // Decode cursor composed of [createdAtIso, id]
      try {
        const [createdAtStr, id] = Buffer.from(query.cursor, 'base64').toString('ascii').split('#');
        where.OR = [
          { createdAt: { lt: new Date(createdAtStr) } },
          {
            createdAt: new Date(createdAtStr),
            id: { lt: id },
          },
        ];
      } catch (e) {
        logger.warn('Invalid cursor provided, falling back to top page');
      }
    }

    const items = await prisma.paymentIntent.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        attempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 3,
        },
        refunds: true,
      },
    });

    let nextCursor: string | null = null;
    let results = items;

    if (items.length > limit) {
      const nextItem = items[limit - 1];
      nextCursor = Buffer.from(
        `${nextItem.createdAt.toISOString()}#${nextItem.id}`
      ).toString('base64');
      results = items.slice(0, limit);
    }

    return {
      items: results.map((i) => ({
        id: i.id,
        amount: i.amount.toString(),
        currency: i.currency,
        status: i.status,
        capturedAmount: i.capturedAmount.toString(),
        refundedAmount: i.refundedAmount.toString(),
        description: i.description,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        attemptsCount: i.attempts.length,
        latestAttempt: i.attempts[0] || null,
        refunds: i.refunds,
      })),
      nextCursor,
      hasMore: nextCursor !== null,
    };
  }

  async getPaymentById(merchantId: string, intentId: string) {
    const intent = await prisma.paymentIntent.findFirst({
      where: { id: intentId, merchantId },
      include: {
        attempts: { orderBy: { attemptNumber: 'asc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        journalEntries: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!intent) {
      throw ApiError.notFound('Payment intent not found');
    }

    return {
      ...intent,
      amount: intent.amount.toString(),
      capturedAmount: intent.capturedAmount.toString(),
      refundedAmount: intent.refundedAmount.toString(),
    };
  }
}

export const paymentService = new PaymentService();
