import { Router, Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

router.use(requireAuth);

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const overview = await analyticsService.getOverview(merchantId);
    return sendSuccess(res, {
      statusCode: 200,
      data: overview,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const days = Number(req.query.days) || 14;
    const trends = await analyticsService.getDailyTrends(merchantId, days);
    return sendSuccess(res, {
      statusCode: 200,
      data: trends,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/methods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.merchant!.id;
    const methods = await analyticsService.getPaymentMethodDistribution(merchantId);
    return sendSuccess(res, {
      statusCode: 200,
      data: methods,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
