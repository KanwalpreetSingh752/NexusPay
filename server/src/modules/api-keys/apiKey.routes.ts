import { Router, Request, Response, NextFunction } from 'express';
import { apiKeyService } from './apiKey.service';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import { createApiKeySchema } from './apiKey.schema';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  validateRequest({ body: createApiKeySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantId = req.merchant!.id;
      const result = await apiKeyService.generateKey(merchantId, req.body);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'API Key generated successfully. Save this secret, it will not be shown again.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const keys = await apiKeyService.listKeys(merchantId);
    return sendSuccess(res, {
      statusCode: 200,
      data: keys,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const keyId = req.params.id as string;
    const revoked = await apiKeyService.revokeKey(merchantId, keyId);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'API Key revoked successfully',
      data: revoked,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
