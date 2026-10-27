import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { ApiError } from '../../utils/apiError';
import { RegisterInput, LoginInput } from './auth.schema';

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAccessToken(user: { id: string; merchantId: string; role: string }): string {
    return jwt.sign(
      {
        sub: user.id,
        merchantId: user.merchantId,
        role: user.role,
      },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );
  }

  private async createRefreshToken(userId: string, family?: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const tokenFamily = family || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        family: tokenFamily,
        expiresAt,
      },
    });

    return rawToken;
  }

  async register(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Atomically create Merchant, User, and default Test API Key
    const result = await prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          businessName: input.businessName,
          email: input.email,
          currency: input.currency.toUpperCase(),
        },
      });

      const user = await tx.user.create({
        data: {
          merchantId: merchant.id,
          email: input.email,
          passwordHash,
          role: 'admin',
        },
      });

      // Default Test API key
      const rawSecret = crypto.randomBytes(24).toString('base64url');
      const prefix = `npay_test_${rawSecret.slice(0, 6)}`;
      const fullKey = `${prefix}_${rawSecret.slice(6)}`;
      const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

      const apiKey = await tx.apiKey.create({
        data: {
          merchantId: merchant.id,
          name: 'Default Test Key',
          keyPrefix: prefix,
          keyHash,
          environment: 'TEST',
        },
      });

      return { merchant, user, initialApiKey: fullKey };
    });

    const accessToken = this.generateAccessToken(result.user);
    const refreshToken = await this.createRefreshToken(result.user.id);

    return {
      merchant: {
        id: result.merchant.id,
        businessName: result.merchant.businessName,
        email: result.merchant.email,
        currency: result.merchant.currency,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 mins in seconds
      },
      initialApiKey: result.initialApiKey,
    };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { merchant: true },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.merchant.status === 'SUSPENDED') {
      throw ApiError.forbidden('Merchant account is suspended. Please contact support.');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      merchant: {
        id: user.merchant.id,
        businessName: user.merchant.businessName,
        email: user.merchant.email,
        currency: user.merchant.currency,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
    };
  }

  async rotateRefreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { merchant: true } } },
    });

    if (!storedToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Token reuse detection: if a revoked token is re-submitted, compromise is suspected!
    if (storedToken.isRevoked) {
      // Invalidate the ENTIRE token family for this user
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, family: storedToken.family },
        data: { isRevoked: true },
      });
      throw ApiError.unauthorized('Refresh token reuse detected. All sessions in this family revoked.');
    }

    if (new Date() > storedToken.expiresAt) {
      throw ApiError.unauthorized('Refresh token expired');
    }

    // Revoke old token and issue a new one in the same family
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const newAccessToken = this.generateAccessToken(storedToken.user);
    const newRefreshToken = await this.createRefreshToken(storedToken.userId, storedToken.family);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
    return { success: true };
  }
}

export const authService = new AuthService();
