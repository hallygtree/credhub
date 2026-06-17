import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { User, UserRole, IUser } from '../models/index.js';
import { Types } from 'mongoose';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId?: string;
  employeeId?: string;
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: Types.ObjectId;
    email: string;
    role: UserRole;
    companyId?: Types.ObjectId;
    employeeId?: Types.ObjectId;
    mustChangePassword: boolean;
  };
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    (req as AuthenticatedRequest).user = {
      id: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
}

export function generateToken(user: IUser): string {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId: user.companyId?.toString(),
    employeeId: user.employeeId?.toString(),
    mustChangePassword: user.mustChangePassword,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

/**
 * Middleware that blocks access if user must change password.
 * Used on protected routes to force password change on first login.
 */
export function requirePasswordChanged(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (authReq.user?.mustChangePassword) {
    next(new ForbiddenError('Password change required before accessing this resource'));
    return;
  }

  next();
}
