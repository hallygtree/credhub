import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { ForbiddenError } from '../utils/errors.js';
import { UserRole } from '../models/index.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (!allowedRoles.includes(user.role)) {
      return next(new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}

export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== UserRole.SUPER_ADMIN) {
    return next(new ForbiddenError('Super admin access required'));
  }
  next();
}

export function requireCompanyAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const requestedCompanyId = req.params.companyId || req.params.id;

  if (!user) {
    return next(new ForbiddenError('User not authenticated'));
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  if (user.role === UserRole.COMPANY_VIEWER || user.role === UserRole.EMPLOYEE) {
    if (!user.companyId) {
      return next(new ForbiddenError('User has no company associated'));
    }

    if (requestedCompanyId && user.companyId.toString() !== requestedCompanyId) {
      return next(new ForbiddenError('Access denied to this company'));
    }
  }

  next();
}

export function scopeByCompany(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    return next(new ForbiddenError('User not authenticated'));
  }

  if ((user.role === UserRole.COMPANY_VIEWER || user.role === UserRole.EMPLOYEE) && user.companyId) {
    req.query.companyId = user.companyId.toString();
  }

  next();
}

export function requireEmployee(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role !== UserRole.EMPLOYEE) {
    return next(new ForbiddenError('Employee access required'));
  }
  next();
}

export function requireUser(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const role = authReq.user?.role;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.CPF_USER) {
    return next(new ForbiddenError('User access required'));
  }
  next();
}

export function requireEmployeeAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const requestedEmployeeId = req.params.employeeId || req.params.id;

  if (!user) {
    return next(new ForbiddenError('User not authenticated'));
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  if (user.role === UserRole.EMPLOYEE) {
    if (!user.employeeId) {
      return next(new ForbiddenError('User has no employee associated'));
    }

    if (requestedEmployeeId && user.employeeId.toString() !== requestedEmployeeId) {
      return next(new ForbiddenError('Access denied to this employee record'));
    }
  }

  next();
}

export function scopeByEmployee(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    return next(new ForbiddenError('User not authenticated'));
  }

  if (user.role === UserRole.EMPLOYEE && user.employeeId) {
    req.query.employeeId = user.employeeId.toString();
  }

  next();
}
