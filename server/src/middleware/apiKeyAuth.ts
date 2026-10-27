import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { requireAuth } from './auth';

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer npay_test_')) {
      throw ApiError.unauthorized(
        'Invalid API Key format. NexusPay Test keys must begin with "Bearer npay_test_"'
      );
    }

    const rawKey = authHeader.slice(7); // strip 'Bearer '
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { merchant: true },
    });

    if (!apiKey) {
      throw ApiError.unauthorized('Invalid or unknown API key');
    }

    if (!apiKey.isActive || apiKey.revokedAt) {
      throw ApiError.unauthorized('This API key has been revoked');
    }

    if (apiKey.merchant.status === 'SUSPENDED') {
      throw ApiError.forbidden('Merchant account is suspended');
    }

    // Update lastUsedAt asynchronously without blocking
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    req.merchant = apiKey.merchant;
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      environment: apiKey.environment,
    };

    next();
  } catch (error) {
    next(error);
  }
}

// Dual auth: accepts either JWT (dashboard) or API Key (external API)
export async function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer npay_test_')) {
    return requireApiKey(req, res, next);
  }
  return requireAuth(req, res, next);
}
