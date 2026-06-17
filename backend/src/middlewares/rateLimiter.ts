import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '../models/index.js';

/** Per-role request limits per window (higher = more permissive). */
const ROLE_LIMITS: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 1000,
  [UserRole.COMPANY_ADMIN]: 400,
  [UserRole.COMPANY_VIEWER]: 300,
  [UserRole.EMPLOYEE]: 200,
  [UserRole.CPF_USER]: 150,
};

const UNAUTHENTICATED_LIMIT = 50;

/**
 * Decode the JWT in the Authorization header (without DB lookup) and return
 * the appropriate per-role limit. Falls back to UNAUTHENTICATED_LIMIT.
 */
function maxForRequest(req: Request): number {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as { role?: UserRole };
      if (decoded?.role && decoded.role in ROLE_LIMITS) {
        return ROLE_LIMITS[decoded.role];
      }
    }
  } catch {
    // expired / invalid token → treat as unauthenticated
  }
  return UNAUTHENTICATED_LIMIT;
}

export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: maxForRequest,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: 'Too many login attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const pixRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: 'Muitas tentativas de pagamento. Tente novamente em alguns minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
