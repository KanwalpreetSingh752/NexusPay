import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

export function idempotencyGuard(operation: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return next(); // Key is optional unless enforced
    }

    const merchantId = req.merchant?.id;
    if (!merchantId) {
      return next(); // Merchant must be identified by previous auth middleware
    }

    // Deeply normalize and sort payload to calculate deterministic hash
    const payloadToHash = {
      body: req.body,
      query: req.query,
      params: req.params,
    };
    const normalized = JSON.stringify(sortObjectKeys(payloadToHash));
    const requestHash = crypto.createHash('sha256').update(normalized).digest('hex');

    try {
      // 1. ATOMIC RESERVATION: Try to insert with status PROCESSING
      await prisma.idempotencyRecord.create({
        data: {
          merchantId,
          operation,
          idempotencyKey,
          requestHash,
          status: 'PROCESSING',
        },
      });

      // We won the reservation lock! Intercept res.json to finalize the record
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        const finalStatus = res.statusCode < 400 ? 'COMPLETED' : 'FAILED';
        prisma.idempotencyRecord
          .update({
            where: {
              merchant_op_key_unique: {
                merchantId,
                operation,
                idempotencyKey,
              },
            },
            data: {
              status: finalStatus,
              responseCode: res.statusCode,
              responseBody: body,
            },
          })
          .catch((err) => {
            logger.error('Failed to finalize idempotency record:', err);
          });

        return originalJson(body);
      };

      return next();
    } catch (err: any) {
      // P2002 is Prisma's code for unique constraint violation
      if (err.code === 'P2002') {
        const existing = await prisma.idempotencyRecord.findUnique({
          where: {
            merchant_op_key_unique: {
              merchantId,
              operation,
              idempotencyKey,
            },
          },
        });

        if (!existing) {
          return next(ApiError.internal('Idempotency race condition lookup failure'));
        }

        // Case A: Key was reused with different payload parameters
        if (existing.requestHash !== requestHash) {
          return next(
            ApiError.badRequest(
              'Idempotency key already used with a different request payload'
            )
          );
        }

        // Case B: Request is actively being processed by another worker/thread
        if (existing.status === 'PROCESSING') {
          return next(
            ApiError.conflict(
              'A request with this idempotency key is currently in progress. Please retry shortly.'
            )
          );
        }

        // Case C: Previous completed response cached
        if (existing.responseBody && existing.responseCode) {
          res.setHeader('X-Idempotency-Replay', 'true');
          return res.status(existing.responseCode).json(existing.responseBody);
        }
      }

      return next(err);
    }
  };
}
