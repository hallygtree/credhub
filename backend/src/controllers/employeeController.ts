import { Request, Response, NextFunction } from 'express';
import { getEmployeeSelf, getEmployeeBalance, getEmployeeSelfTransactions, updateEmployeeSelf } from '../services/employeeService.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../middlewares/index.js';
import { ForbiddenError } from '../utils/errors.js';
import { updateEmployeeSelfSchema } from '../validators/employee.js';

export async function getEmployeeMeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw new ForbiddenError('Employee ID not found in token');
    }

    const employee = await getEmployeeSelf(employeeId.toString());
    sendSuccess(res, { employee });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeBalanceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw new ForbiddenError('Employee ID not found in token');
    }

    const result = await getEmployeeBalance(employeeId.toString());
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw new ForbiddenError('Employee ID not found in token');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await getEmployeeSelfTransactions(employeeId.toString(), page, limit);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateEmployeeMeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const employeeId = authReq.user.employeeId;

    if (!employeeId) {
      throw new ForbiddenError('Employee ID not found in token');
    }

    const validatedData = updateEmployeeSelfSchema.parse(req.body);
    const employee = await updateEmployeeSelf(employeeId.toString(), validatedData);
    sendSuccess(res, { employee }, 200, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
}
