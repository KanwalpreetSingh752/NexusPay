import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.warn(`Redis connection error: ${err.message}. Operations will degrade safely.`);
});

export async function connectRedis() {
  try {
    await redis.connect();
  } catch (err: any) {
    logger.warn(`Initial Redis connection failed (${err.message}). Continuing with graceful retry.`);
  }
}
