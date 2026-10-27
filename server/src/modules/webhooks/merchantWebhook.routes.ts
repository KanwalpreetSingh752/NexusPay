import { Router, Request, Response, NextFunction } from 'express';
import { merchantWebhookService } from './merchantWebhook.service';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validator';
import {
  registerWebhookEndpointSchema,
  updateWebhookEndpointSchema,
} from './merchantWebhook.schema';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  validateRequest({ body: registerWebhookEndpointSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantId = req.merchant!.id;
      const result = await merchantWebhookService.registerEndpoint(merchantId, req.body);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Webhook endpoint registered successfully',
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
    const endpoints = await merchantWebhookService.listEndpoints(merchantId);
    return sendSuccess(res, {
      statusCode: 200,
      data: endpoints,
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  validateRequest({ body: updateWebhookEndpointSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const merchantId = req.merchant!.id;
      const endpointId = req.params.id as string;
      const endpoint = await merchantWebhookService.updateEndpoint(
        merchantId,
        endpointId,
        req.body
      );
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Webhook endpoint updated',
        data: endpoint,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const endpointId = req.params.id as string;
    await merchantWebhookService.deleteEndpoint(merchantId, endpointId);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Webhook endpoint deleted',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const endpointId = req.params.id as string;
    const deliveries = await merchantWebhookService.listDeliveries(merchantId, endpointId);
    return sendSuccess(res, {
      statusCode: 200,
      data: deliveries,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
