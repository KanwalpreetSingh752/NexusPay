import { app } from './app';
import { config } from './config';
import { connectDatabase, prisma } from './config/database';
import { connectRedis, redis } from './config/redis';
import { logger } from './utils/logger';
import { outboxWorker } from './workers/outboxWorker';
import { reconciliationWorker } from './workers/reconciliationWorker';

async function bootstrap() {
  await connectDatabase();
  await connectRedis();

  // Start background workers
  outboxWorker.start();
  reconciliationWorker.start();

  const server = app.listen(config.port, () => {
    logger.info(`NexusPay Gateway API running on port ${config.port} (${config.nodeEnv})`);
    logger.info(`Health check endpoint: http://localhost:${config.port}/health/ready`);
    logger.info(`API Base route: http://localhost:${config.port}${config.apiPrefix}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down NexusPay gracefully...`);
    outboxWorker.stop();
    reconciliationWorker.stop();

    server.close(async () => {
      logger.info('HTTP server closed.');
      await prisma.$disconnect();
      logger.info('Database disconnected.');
      try {
        await redis.quit();
        logger.info('Redis disconnected.');
      } catch {}
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forceful shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error:', err);
  process.exit(1);
});
