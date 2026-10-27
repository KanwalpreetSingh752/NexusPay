import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class ReconciliationWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMs = 30000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Payment Reconciliation Worker started');

    this.intervalId = setInterval(async () => {
      try {
        await this.reconcileStaleIntents();
        await this.cleanupStaleIdempotencyKeys();
      } catch (err) {
        logger.error('Error in Reconciliation Worker:', err);
      }
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Payment Reconciliation Worker stopped');
  }

  /**
   * Recovers intents stuck in PROCESSING / attempts in PENDING_PROVIDER
   * or UNCERTAIN past 2 minutes without resolution.
   */
  async reconcileStaleIntents() {
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);

    const staleAttempts = await prisma.paymentAttempt.findMany({
      where: {
        status: { in: ['PENDING_PROVIDER', 'UNCERTAIN'] },
        updatedAt: { lt: staleThreshold },
      },
      include: { paymentIntent: true },
      take: 20,
    });

    for (const attempt of staleAttempts) {
      logger.info(`Reconciling stale attempt ${attempt.id} for intent ${attempt.paymentIntentId}`);

      // If order was never created upstream after 2 minutes, mark as FAILED
      if (!attempt.providerOrderId) {
        await prisma.$transaction(async (tx) => {
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'FAILED',
              failureCode: 'RECONCILIATION_TIMEOUT',
              failureMessage: 'Payment attempt timed out before order creation',
            },
          });

          // Check if any other successful attempt exists for this intent
          const anySuccess = await tx.paymentAttempt.findFirst({
            where: { paymentIntentId: attempt.paymentIntentId, status: 'SUCCEEDED' },
          });

          if (!anySuccess) {
            await tx.paymentIntent.update({
              where: { id: attempt.paymentIntentId },
              data: { status: 'FAILED' },
            });
          }
        });
      }
    }
  }

  /**
   * Resets idempotency keys stuck in PROCESSING for > 5 minutes
   * (e.g., due to an abrupt node crash mid-execution).
   */
  async cleanupStaleIdempotencyKeys() {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const count = await prisma.idempotencyRecord.updateMany({
      where: {
        status: 'PROCESSING',
        createdAt: { lt: staleThreshold },
      },
      data: {
        status: 'FAILED',
        responseCode: 504,
        responseBody: {
          success: false,
          error: {
            message: 'Original operation timed out before completion (recovered by janitor)',
          },
        },
      },
    });

    if (count.count > 0) {
      logger.info(`Cleaned up ${count.count} stale idempotency keys stuck in PROCESSING`);
    }
  }
}

export const reconciliationWorker = new ReconciliationWorker();
