import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import axios from 'axios';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    sendError(res, `Validation error: ${messages}`, 422);
    return;
  }

  if (err.name === 'MongoServerError') {
    const mongoError = err as Error & { code?: number; keyValue?: Record<string, unknown> };
    if (mongoError.code === 11000) {
      const field = Object.keys(mongoError.keyValue || {})[0] || 'field';
      sendError(res, `Duplicate value for ${field}`, 409);
      return;
    }
  }

  if (err.name === 'CastError') {
    sendError(res, 'Invalid ID format', 400);
    return;
  }

  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data;
    const mpMessage = data?.message
      || data?.error
      || (Array.isArray(data?.cause) && data.cause[0]?.description)
      || (typeof data?.cause === 'string' && data.cause)
      || JSON.stringify(data);
    sendError(res, `Erro do provedor de pagamento: ${mpMessage}`, 502);
    return;
  }

  sendError(res, 'Internal server error', 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}
