import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { sendSuccess } from '../utils/response.js';
import * as userService from '../services/userService.js';

export async function getUserMeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id, role, employeeId } = authReq.user!;

    const profile = await userService.getUserProfile(id.toString(), role, employeeId?.toString());

    sendSuccess(res, { profile });
  } catch (error) {
    next(error);
  }
}

export async function getUserBalanceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id, role, employeeId } = authReq.user!;

    const result = await userService.getUserBalance(id.toString(), role, employeeId?.toString());

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getUserTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id, role, employeeId } = authReq.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await userService.getUserTransactions(id.toString(), role, employeeId?.toString(), page, limit);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateUserMeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id, role, employeeId } = authReq.user!;

    const profile = await userService.updateUserProfile(id.toString(), role, employeeId?.toString(), req.body);

    sendSuccess(res, { profile });
  } catch (error) {
    next(error);
  }
}
