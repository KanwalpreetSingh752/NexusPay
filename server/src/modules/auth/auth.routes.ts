import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middleware/validator';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.schema';
import { slidingWindowRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Auth rate limiter: 10 attempts per minute per IP to mitigate brute force
const authLimiter = slidingWindowRateLimiter({
  maxRequests: 15,
  windowSec: 60,
  keyPrefix: 'rl:auth',
});

router.post(
  '/register',
  authLimiter,
  validateRequest({ body: registerSchema }),
  authController.register
);

router.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  authController.login
);

router.post(
  '/refresh',
  authLimiter,
  validateRequest({ body: refreshTokenSchema }),
  authController.refreshToken
);

router.post(
  '/logout',
  authController.logout
);

export default router;
