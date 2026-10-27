import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';

interface JwtPayload {
  sub: string;
  merchantId: string;
  role: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Access token has expired');
      }
      throw ApiError.unauthorized('Invalid access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { merchant: true },
    });

    if (!user) {
      throw ApiError.unauthorized('User associated with token no longer exists');
    }

    if (user.merchant.status === 'SUSPENDED') {
      throw ApiError.forbidden('Merchant account is suspended');
    }

    req.user = user;
    req.merchant = user.merchant;
    next();
  } catch (error) {
    next(error);
  }
}
