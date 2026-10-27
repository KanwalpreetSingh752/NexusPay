import { Router } from 'express';
import { paymentController } from './payment.controller';
import { requireAuthOrApiKey } from '../../middleware/apiKeyAuth';
import { idempotencyGuard } from '../../middleware/idempotency';
import { validateRequest } from '../../middleware/validator';
import {
  createPaymentIntentSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  listPaymentsQuerySchema,
} from './payment.schema';
import { slidingWindowRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// 120 requests/min per merchant/IP
const paymentLimiter = slidingWindowRateLimiter({
  maxRequests: 120,
  windowSec: 60,
  keyPrefix: 'rl:payments',
});

router.use(requireAuthOrApiKey);
router.use(paymentLimiter);

router.post(
  '/intents',
  idempotencyGuard('create_payment_intent'),
  validateRequest({ body: createPaymentIntentSchema }),
  paymentController.createIntent
);

router.post(
  '/verify',
  idempotencyGuard('verify_payment'),
  validateRequest({ body: verifyPaymentSchema }),
  paymentController.verifyPayment
);

router.post(
  '/:id/refunds',
  idempotencyGuard('process_refund'),
  validateRequest({ body: refundPaymentSchema }),
  paymentController.processRefund
);

router.get(
  '/',
  validateRequest({ query: listPaymentsQuerySchema }),
  paymentController.listPayments
);

router.get('/:id', paymentController.getPaymentById);

export default router;
