import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '../models/index.js';

/**
 * Maintenance mode middleware.
 *
 * When MAINTENANCE_MODE=true, all routes return 503 except:
 *  - GET /api/v1/health  (health check)
 *  - Requests authenticated as SUPER_ADMIN (decoded from JWT without DB round-trip)
 */
export function maintenanceMode(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!env.MAINTENANCE_MODE) {
    return next();
  }

  // Always allow health endpoint
  if (req.path === '/health') {
    return next();
  }

  // Allow SUPER_ADMIN: decode JWT without DB lookup for speed
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as { role?: string };
      if (decoded?.role === UserRole.SUPER_ADMIN) {
        return next();
      }
    } catch {
      // Invalid/expired token — fall through to 503
    }
  }

  res.status(503).json({
    success: false,
    error: 'Sistema em manutenção. Tente novamente em breve.',
    maintenanceMode: true,
  });
}
