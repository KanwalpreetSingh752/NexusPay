import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess } from '../../utils/apiResponse';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validator';

const router = Router();

router.use(requireAuth);

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        users: { select: { id: true, email: true, role: true, createdAt: true } },
        _count: {
          select: {
            paymentIntents: true,
            apiKeys: true,
            webhookEndpoints: true,
          },
        },
      },
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: merchant,
    });
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  businessName: z.string().min(2).max(100).optional(),
});

router.patch(
  '/me',
  validateRequest({ body: updateProfileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantId = req.merchant!.id;
      const updated = await prisma.merchant.update({
        where: { id: merchantId },
        data: {
          businessName: req.body.businessName,
        },
      });

      return sendSuccess(res, {
        statusCode: 200,
        message: 'Profile updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
