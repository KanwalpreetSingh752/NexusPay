import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  amount: z
    .number()
    .int('Amount must be an integer in minor currency units (paise)')
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount cannot exceed ₹10,00,000'),
  currency: z.string().length(3).default('INR'),
  description: z.string().max(500).optional(),
  // Optional customer context — stored in metadata for CRM enrichment
  customerId: z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
});

export const refundPaymentSchema = z.object({
  amount: z
    .number()
    .int('Amount must be an integer in minor currency units')
    .positive('Refund amount must be positive'),
  reason: z.string().max(255).optional(),
});

export const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z
    .enum([
      'REQUIRES_PAYMENT',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ])
    .optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
