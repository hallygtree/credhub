import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const startTime = Date.now();

  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  });

  next();
}
