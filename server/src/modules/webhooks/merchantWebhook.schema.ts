import { z } from 'zod';

export const registerWebhookEndpointSchema = z.object({
  url: z.string().url('Must be a valid HTTP or HTTPS URL'),
  subscribedEvents: z
    .array(z.string())
    .min(1, 'Must subscribe to at least one event')
    .default(['payment.succeeded', 'refund.succeeded', 'refund.partial']),
});

export const updateWebhookEndpointSchema = z.object({
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
  subscribedEvents: z.array(z.string()).optional(),
});

export type RegisterWebhookEndpointInput = z.infer<typeof registerWebhookEndpointSchema>;
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;
