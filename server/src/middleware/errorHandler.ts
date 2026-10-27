import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(`[API Error ${err.statusCode}] ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        details: err.details,
        stack: err.stack,
      });
    } else {
      logger.warn(`[Client Error ${err.statusCode}] ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        details: err.details,
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        details: err.details,
      },
    });
  }

  // Unhandled / system errors
  logger.error('[Unhandled System Error]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
    },
  });
}
