import express from 'express';
import cors from 'cors';
import { config } from './config';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import paymentRoutes from './modules/payments/payment.routes';
import providerWebhookRoutes from './modules/webhooks/providerWebhook.routes';
import merchantWebhookRoutes from './modules/webhooks/merchantWebhook.routes';
import apiKeyRoutes from './modules/api-keys/apiKey.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import merchantRoutes from './modules/merchants/merchant.routes';

export const app = express();

// Enable CORS
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-NexusPay-Signature'],
  })
);

// Capture raw body buffer for Razorpay & NexusPay webhook HMAC verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
    limit: '2mb',
  })
);
app.use(express.urlencoded({ extended: true }));

// Liveness Check
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness Check: verifies both PostgreSQL and Redis connectivity
app.get('/health/ready', async (_req, res) => {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unreachable';
  }

  try {
    if (redis.status !== 'ready') {
      redisStatus = 'degraded';
    } else {
      await redis.ping();
    }
  } catch {
    redisStatus = 'unreachable';
  }

  const isHealthy = dbStatus === 'healthy';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'unhealthy',
    dependencies: {
      database: dbStatus,
      redis: redisStatus,
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/payments`, paymentRoutes);
app.use(`${config.apiPrefix}/webhooks/provider`, providerWebhookRoutes);
app.use(`${config.apiPrefix}/webhooks/merchant`, merchantWebhookRoutes);
app.use(`${config.apiPrefix}/api-keys`, apiKeyRoutes);
app.use(`${config.apiPrefix}/analytics`, analyticsRoutes);
app.use(`${config.apiPrefix}/merchants`, merchantRoutes);

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
});

// Centralized error handler
app.use(errorHandler);
