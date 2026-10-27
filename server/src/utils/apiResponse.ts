import { Response } from 'express';

export interface ApiResponseOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(res: Response, options: ApiResponseOptions<T>) {
  const { statusCode = 200, message, data, meta } = options;
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
}

export function sendError(
  res: Response,
  statusCode = 500,
  message = 'An unexpected error occurred',
  details?: unknown
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      details,
    },
  });
}
