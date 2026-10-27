import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(100).default('Default API Key'),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
