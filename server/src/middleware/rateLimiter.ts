import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redis } from '../config/redis';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

// In-memory sliding window fallback if Redis is down
const memoryStore = new Map<string, number[]>();

export function slidingWindowRateLimiter(options: {
  maxRequests: number;
  windowSec: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const {
    maxRequests,
    windowSec,
    keyPrefix = 'rl',
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown-client',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyGenerator(req);
    const redisKey = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    try {
      if (redis.status === 'ready') {
        const multi = redis.multi();
        multi.zremrangebyscore(redisKey, 0, windowStart);
        multi.zcard(redisKey);
        multi.zadd(redisKey, now, `${now}:${crypto.randomUUID()}`);
        multi.expire(redisKey, windowSec);

        const results = await multi.exec();
        if (results && results[1]) {
          const currentCount = results[1][1] as number;
          if (currentCount >= maxRequests) {
            res.setHeader('Retry-After', String(windowSec));
            return next(
              ApiError.tooManyRequests(
                `Rate limit exceeded. Maximum ${maxRequests} requests allowed per ${windowSec} seconds.`
              )
            );
          }
        }
        return next();
      }
    } catch (err: any) {
      logger.warn(`Redis rate limiter failed: ${err.message}. Falling back to in-memory window.`);
    }

    // In-memory sliding window fallback
    let timestamps = memoryStore.get(redisKey) || [];
    timestamps = timestamps.filter((t) => t > windowStart);
    if (timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', String(windowSec));
      return next(
        ApiError.tooManyRequests(
          `Rate limit exceeded. Maximum ${maxRequests} requests allowed per ${windowSec} seconds.`
        )
      );
    }
    timestamps.push(now);
    memoryStore.set(redisKey, timestamps);
    return next();
  };
}
