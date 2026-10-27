import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class OutboxWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMs = 4000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Outbox Relay Worker started');

    this.intervalId = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (err) {
        logger.error('Error in Outbox Relay Worker:', err);
      }
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Outbox Relay Worker stopped');
  }

  async processBatch() {
    // 1. Transactionally lock pending outbox events using FOR UPDATE SKIP LOCKED
    await prisma.$transaction(async (tx) => {
      const pendingEvents = await tx.$queryRaw<any[]>`
        SELECT id, aggregate_type, aggregate_id, event_type, payload, retry_count, max_retries
        FROM outbox_events
        WHERE status IN ('PENDING', 'PROCESSING')
          AND next_retry_at <= NOW()
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `;

      if (!pendingEvents || pendingEvents.length === 0) {
        return;
      }

      for (const event of pendingEvents) {
        await this.deliverEvent(tx, event);
      }
    });
  }

  private async deliverEvent(tx: any, event: any) {
    // Find merchantId through aggregate
    let merchantId: string | null = null;

    if (event.aggregate_type === 'payment_intent') {
      const intent = await tx.paymentIntent.findUnique({
        where: { id: event.aggregate_id },
      });
      merchantId = intent?.merchantId;
    } else if (event.aggregate_type === 'refund') {
      const refund = await tx.refund.findUnique({
        where: { id: event.aggregate_id },
        include: { paymentIntent: true },
      });
      merchantId = refund?.paymentIntent?.merchantId;
    }

    if (!merchantId) {
      // Aggregate no longer exists, mark DELIVERED to avoid infinite retry
      await tx.outboxEvent.update({
        where: { id: BigInt(event.id) },
        data: { status: 'DELIVERED', processedAt: new Date() },
      });
      return;
    }

    // Persist logical merchant event
    const merchantEvent = await tx.merchantWebhookEvent.create({
      data: {
        merchantId,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        payload: event.payload,
      },
    });

    // Find subscribed active endpoints
    const endpoints = await tx.merchantWebhookEndpoint.findMany({
      where: {
        merchantId,
        isActive: true,
        subscribedEvents: { has: event.event_type },
      },
    });

    if (endpoints.length === 0) {
      await tx.outboxEvent.update({
        where: { id: BigInt(event.id) },
        data: { status: 'DELIVERED', processedAt: new Date() },
      });
      return;
    }

    let allSuccessful = true;

    for (const ep of endpoints) {
      const timestamp = Math.floor(Date.now() / 1000);
      const payloadString = JSON.stringify(merchantEvent.payload);
      const signature = crypto
        .createHmac('sha256', ep.secretHash)
        .update(`${timestamp}.${payloadString}`)
        .digest('hex');

      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(ep.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NexusPay-Signature': `t=${timestamp},v1=${signature}`,
            'X-NexusPay-Event': event.event_type,
            'User-Agent': 'NexusPay-Webhook-Relay/1.0',
          },
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = response.status;
        responseBody = (await response.text()).slice(0, 1000);

        if (!response.ok) {
          allSuccessful = false;
        }
      } catch (err: any) {
        allSuccessful = false;
        errorMessage = err.message;
      }

      await tx.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          eventId: merchantEvent.id,
          attemptNumber: event.retry_count + 1,
          httpStatusCode: statusCode,
          responseBody,
          errorMessage,
          deliveredAt: statusCode && statusCode >= 200 && statusCode < 300 ? new Date() : null,
        },
      });
    }

    if (allSuccessful) {
      await tx.outboxEvent.update({
        where: { id: BigInt(event.id) },
        data: { status: 'DELIVERED', processedAt: new Date() },
      });
    } else {
      const nextRetryCount = event.retry_count + 1;
      if (nextRetryCount >= event.max_retries) {
        await tx.outboxEvent.update({
          where: { id: BigInt(event.id) },
          data: { status: 'FAILED', processedAt: new Date() },
        });
      } else {
        // Exponential backoff: 5s, 10s, 20s, 40s, 80s... max 1 hour
        const backoffMs = Math.min(5000 * Math.pow(2, nextRetryCount), 3600000);
        await tx.outboxEvent.update({
          where: { id: BigInt(event.id) },
          data: {
            status: 'PENDING',
            retryCount: nextRetryCount,
            nextRetryAt: new Date(Date.now() + backoffMs),
          },
        });
      }
    }
  }
}

export const outboxWorker = new OutboxWorker();
