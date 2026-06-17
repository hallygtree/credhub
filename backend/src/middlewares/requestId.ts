import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Assigns a unique request ID to every incoming request.
 * Uses the X-Request-Id header if provided by the client/proxy, otherwise generates a UUID.
 * The ID is echoed back in the X-Request-Id response header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}
