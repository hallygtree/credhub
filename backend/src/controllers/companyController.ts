import { Request, Response, NextFunction } from 'express';
import { getCompanyOverview } from '../services/companyService.js';
import { createEmployee, getEmployeesByCompanyForViewer, getEmployeeByIdForViewer, getEmployeeDepositsOnly, getCompanyTransactions, deleteEmployee, reloadSelectedBalances, updateEmployeeByViewer } from '../services/employeeService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { AuthenticatedRequest } from '../middlewares/index.js';
import { ForbiddenError, BadRequestError } from '../utils/errors.js';
import { createEmployeeSchema, updateEmployeeViewerSchema } from '../validators/index.js';

export async function getCompanyOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    const result = await getCompanyOverview(authReq.user.companyId.toString());
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createMyEmployeeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    const validatedData = createEmployeeSchema.parse({
      ...req.body,
      companyId: authReq.user.companyId.toString(),
    });

    const employee = await createEmployee(validatedData);
    sendCreated(res, { employee }, 'Employee created successfully');
  } catch (error) {
    next(error);
  }
}

export async function getMyCompanyEmployeesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const page = String(req.query.page || '1');
    const limit = String(req.query.limit || '20');
    const search = req.query.search ? String(req.query.search) : undefined;

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    // COMPANY_VIEWER: employees without balance
    const result = await getEmployeesByCompanyForViewer(
      authReq.user.companyId.toString(),
      parseInt(page),
      parseInt(limit),
      search
    );

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeDetailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = String(req.params.id);

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    // COMPANY_VIEWER: no balance, only deposit transactions
    const employee = await getEmployeeByIdForViewer(id, authReq.user.companyId.toString());

    const page = String(req.query.page || '1');
    const limit = String(req.query.limit || '20');
    const transactions = await getEmployeeDepositsOnly(
      id,
      authReq.user.companyId.toString(),
      parseInt(page),
      parseInt(limit)
    );

    sendSuccess(res, { employee, transactions });
  } catch (error) {
    next(error);
  }
}

export async function getMyCompanyTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '10'));

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    const result = await getCompanyTransactions(
      authReq.user.companyId.toString(),
      page,
      limit
    );

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateMyEmployeeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = String(req.params.id);

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    const validatedData = updateEmployeeViewerSchema.parse(req.body);
    const employee = await updateEmployeeByViewer(
      id,
      authReq.user.companyId.toString(),
      validatedData
    );

    sendSuccess(res, { employee }, 200, 'Employee updated');
  } catch (error) {
    next(error);
  }
}

export async function deleteMyEmployeeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = String(req.params.id);

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    await deleteEmployee(id, authReq.user.companyId.toString());

    sendSuccess(res, null, 200, 'Employee deleted');
  } catch (error) {
    next(error);
  }
}

export async function reloadBalancesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { employeeIds, amount } = req.body;

    if (!authReq.user.companyId) {
      throw new ForbiddenError('No company associated with user');
    }

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw new BadRequestError('Employee IDs are required');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestError('Amount must be a positive number');
    }

    const result = await reloadSelectedBalances(
      authReq.user.companyId.toString(),
      employeeIds,
      amount,
      authReq.user.id
    );

    sendSuccess(res, result, 200, 'Balances reloaded successfully');
  } catch (error) {
    next(error);
  }
}
