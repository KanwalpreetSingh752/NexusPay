import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load from server directory or root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const configSchema = z.object({
  port: z.coerce.number().default(4000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  apiPrefix: z.string().default('/api/v1'),
  frontendUrl: z.string().default('http://localhost:5173'),

  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),

  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    url: z.string().default('redis://localhost:6379'),
  }),

  jwt: z.object({
    accessSecret: z.string().min(16),
    refreshSecret: z.string().min(16),
    accessExpiresIn: z.string().default('15m'),
    refreshExpiresIn: z.string().default('7d'),
  }),

  razorpay: z.object({
    keyId: z.string().default('rzp_test_NexusDemoKey01'),
    keySecret: z.string().default('NexusDemoSecretKey123456'),
    webhookSecret: z.string().default('NexusDemoWebhookSecret999'),
    simulationMode: z
      .string()
      .transform((val) => val === 'true')
      .default('true'),
  }),
});

const parsed = configSchema.safeParse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  apiPrefix: process.env.API_PREFIX,
  frontendUrl: process.env.FRONTEND_URL,
  databaseUrl: process.env.DATABASE_URL,
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    url: process.env.REDIS_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    simulationMode: process.env.RAZORPAY_SIMULATION_MODE,
  },
});

if (!parsed.success) {
  console.error('Invalid configuration environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
