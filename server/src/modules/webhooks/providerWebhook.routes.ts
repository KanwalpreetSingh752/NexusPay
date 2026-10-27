import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { razorpayWrapper } from '../../integrations/razorpay/razorpay.client';
import { logger } from '../../utils/logger';

const router = Router();

router.post('/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!signature && process.env.NODE_ENV === 'production') {
    logger.warn('Razorpay webhook missing signature');
    return res.status(400).json({ error: 'Missing signature header' });
  }

  // 1. Signature verification against exact raw body buffer
  if (req.rawBody && signature) {
    const isValid = razorpayWrapper.verifyWebhookSignature(req.rawBody, signature);
    if (!isValid) {
      logger.warn('Invalid Razorpay webhook signature received');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  const eventPayload = req.body;
  const eventType = eventPayload.event || 'unknown';
  const providerEventId =
    eventPayload.event_id ||
    eventPayload.id ||
    `rzp_evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // 2. Immediate ACK to prevent provider retry storms
  res.status(200).json({ received: true });

  // 3. Deduplication & Persist in provider_webhook_events
  try {
    const existing = await prisma.providerWebhookEvent.findUnique({
      where: { providerEventId },
    });

    if (existing) {
      logger.info(`Duplicate provider event received (${providerEventId}), skipping.`);
      return;
    }

    const recordedEvent = await prisma.providerWebhookEvent.create({
      data: {
        provider: 'razorpay',
        providerEventId,
        eventType,
        payload: eventPayload,
        status: 'RECEIVED',
      },
    });

    // 4. Asynchronous Domain Reconciliation based on event type
    await handleProviderEvent(recordedEvent.id, eventType, eventPayload);
  } catch (err: any) {
    logger.error('Error handling Razorpay webhook event:', err);
  }
});

async function handleProviderEvent(
  recordedEventId: string,
  eventType: string,
  payload: any
) {
  try {
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentData = payload.payload?.payment?.entity || payload.payment;
      const orderId = paymentData?.order_id;
      const paymentId = paymentData?.id;

      if (orderId && paymentId) {
        const attempt = await prisma.paymentAttempt.findFirst({
          where: { providerOrderId: orderId },
          include: { paymentIntent: true },
        });

        if (attempt && attempt.paymentIntent.status !== 'SUCCEEDED') {
          await prisma.$transaction(async (tx) => {
            const updatedIntent = await tx.paymentIntent.update({
              where: { id: attempt.paymentIntentId },
              data: {
                status: 'SUCCEEDED',
                capturedAmount: attempt.paymentIntent.amount,
              },
            });

            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: {
                status: 'SUCCEEDED',
                providerPaymentId: paymentId,
                paymentMethod: paymentData.method,
              },
            });

            await tx.transactionJournalEntry.create({
              data: {
                merchantId: updatedIntent.merchantId,
                paymentIntentId: updatedIntent.id,
                entryType: 'PAYMENT_CAPTURE',
                grossAmount: updatedIntent.amount,
                feeAmount: BigInt(Math.floor(Number(updatedIntent.amount) * 0.02)),
                netAmount:
                  updatedIntent.amount -
                  BigInt(Math.floor(Number(updatedIntent.amount) * 0.02)),
                currency: updatedIntent.currency,
                description: `Authoritative capture from webhook: ${paymentId}`,
              },
            });

            await tx.outboxEvent.create({
              data: {
                aggregateType: 'payment_intent',
                aggregateId: updatedIntent.id,
                eventType: 'payment.succeeded',
                payload: {
                  intentId: updatedIntent.id,
                  amount: updatedIntent.amount.toString(),
                  currency: updatedIntent.currency,
                  providerPaymentId: paymentId,
                  method: paymentData.method,
                },
              },
            });
          });
        }
      }
    }

    await prisma.providerWebhookEvent.update({
      where: { id: recordedEventId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  } catch (err: any) {
    logger.error(`Failed to process recorded event ${recordedEventId}:`, err);
    await prisma.providerWebhookEvent.update({
      where: { id: recordedEventId },
      data: { status: 'FAILED', errorMessage: err.message },
    });
  }
}

export default router;
