import crypto from 'crypto';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/apiError';
import { CreateApiKeyInput } from './apiKey.schema';

export class ApiKeyService {
  async generateKey(merchantId: string, input: CreateApiKeyInput) {
    // 1. Generate 24 cryptographically random bytes
    const randomSecret = crypto.randomBytes(24).toString('base64url');
    // Prefix: e.g. "npay_test_a1b2c3"
    const prefix = `npay_test_${randomSecret.slice(0, 6)}`;
    const fullKey = `${prefix}_${randomSecret.slice(6)}`;

    // 2. Compute SHA-256 hash for secure storage
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        merchantId,
        name: input.name,
        keyPrefix: prefix,
        keyHash,
        environment: 'TEST',
        isActive: true,
      },
    });

    return {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        environment: apiKey.environment,
        createdAt: apiKey.createdAt,
      },
      secret: fullKey, // Revealed ONCE
    };
  }

  async listKeys(merchantId: string) {
    const keys = await prisma.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        environment: true,
        isActive: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    return keys;
  }

  async revokeKey(merchantId: string, keyId: string) {
    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, merchantId },
    });

    if (!key) {
      throw ApiError.notFound('API Key not found');
    }

    if (!key.isActive || key.revokedAt) {
      throw ApiError.badRequest('API Key is already revoked');
    }

    return await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        revokedAt: true,
      },
    });
  }
}

export const apiKeyService = new ApiKeyService();
