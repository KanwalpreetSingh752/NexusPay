import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service';
import { sendSuccess } from '../../utils/apiResponse';

export class PaymentController {
  async createIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const merchantId = req.merchant!.id;
      const result = await paymentService.createPaymentIntent(merchantId, req.body);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Payment intent created successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const merchantId = req.merchant!.id;
      const result = await paymentService.verifyPayment(merchantId, req.body);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Payment successfully verified and settled',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async processRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const merchantId = req.merchant!.id;
      const id = req.params.id as string;
      const result = await paymentService.processRefund(merchantId, id, req.body);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Refund executed successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const merchantId = req.merchant!.id;
      const result = await paymentService.listPayments(merchantId, req.query as any);
      return sendSuccess(res, {
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const merchantId = req.merchant!.id;
      const id = req.params.id as string;
      const result = await paymentService.getPaymentById(merchantId, id);
      return sendSuccess(res, {
        statusCode: 200,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
