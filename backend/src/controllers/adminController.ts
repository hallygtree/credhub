import { Request, Response, NextFunction } from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  getCompanyViewer,
  updateCompanyViewer,
} from '../services/companyService.js';
import {
  getEmployeesByCompany,
  adjustBalance,
  getCompanyTransactions,
  updateEmployeeByAdmin,
} from '../services/employeeService.js';
import { getAdminOverview, getRecentActivity, getAllTransactions, getSubscribers, getCpfUserDetail, updateCpfUserCardNumber, searchByCardNumber, registerPurchaseByCard, checkAllConsistency, getTransactionsCsv, reconcileFinancialIntegrity } from '../services/adminService.js';
import {
  createCompanySchema,
  updateCompanySchema,
  adjustBalanceSchema,
} from '../validators/index.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { AuthenticatedRequest } from '../middlewares/index.js';

export async function getOverviewHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [overview, recentActivity] = await Promise.all([
      getAdminOverview(),
      getRecentActivity(5),
    ]);
    sendSuccess(res, { overview, recentActivity });
  } catch (error) {
    next(error);
  }
}

export async function getCompaniesHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companies = await getAllCompanies();
    sendSuccess(res, { companies });
  } catch (error) {
    next(error);
  }
}

export async function createCompanyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedData = createCompanySchema.parse(req.body);
    const company = await createCompany(validatedData);
    sendCreated(res, { company }, 'Company created successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCompanyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const company = await getCompanyById(id);
    sendSuccess(res, { company });
  } catch (error) {
    next(error);
  }
}

export async function updateCompanyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const validatedData = updateCompanySchema.parse(req.body);
    const company = await updateCompany(id, validatedData);
    sendSuccess(res, { company }, 200, 'Company updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCompanyEmployeesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const page = String(req.query.page || '1');
    const limit = String(req.query.limit || '20');
    const search = req.query.search ? String(req.query.search) : undefined;

    await getCompanyById(id);

    const result = await getEmployeesByCompany(
      id,
      parseInt(page),
      parseInt(limit),
      search
    );

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function adjustBalanceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const authReq = req as AuthenticatedRequest;
    const validatedData = adjustBalanceSchema.parse(req.body);

    const result = await adjustBalance(id, validatedData, authReq.user.id, authReq.user.role);

    sendSuccess(res, result, 200, 'Balance adjusted successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCompanyTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '10'));

    await getCompanyById(id);

    const result = await getCompanyTransactions(id, page, limit);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getAllTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '100'));

    const result = await getAllTransactions(page, limit);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getCompanyViewerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const viewer = await getCompanyViewer(id);
    sendSuccess(res, { viewer });
  } catch (error) {
    next(error);
  }
}

export async function updateCompanyViewerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const { name, email, password } = req.body;
    const viewer = await updateCompanyViewer(id, { name, email, password });
    sendSuccess(res, { viewer }, 200, 'Viewer updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateAdminEmployeeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const { cardNumber } = req.body;

    const employee = await updateEmployeeByAdmin(id, { cardNumber });
    sendSuccess(res, { employee }, 200, 'Cartao atualizado com sucesso');
  } catch (error) {
    next(error);
  }
}

export async function getSubscribersHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscribers = await getSubscribers();
    sendSuccess(res, { subscribers });
  } catch (error) {
    next(error);
  }
}

export async function getCpfUserDetailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const result = await getCpfUserDetail(id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateCpfUserCardNumberHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const { cardNumber } = req.body;
    const result = await updateCpfUserCardNumber(id, cardNumber || null);
    sendSuccess(res, result, 200, 'Cartao atualizado com sucesso');
  } catch (error) {
    next(error);
  }
}

export async function searchByCardNumberHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const searchTerm = String(req.params.cardNumber);
    const holders = await searchByCardNumber(searchTerm);
    sendSuccess(res, { holders });
  } catch (error) {
    next(error);
  }
}

export async function registerPurchaseByCardHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { cardNumber, amount, description } = req.body;
    const result = await registerPurchaseByCard(
      cardNumber,
      amount,
      description || 'Compra',
      authReq.user!.id,
      authReq.user!.role
    );
    sendSuccess(res, result, 200, 'Compra registrada com sucesso');
  } catch (error) {
    next(error);
  }
}

export async function checkConsistencyHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await checkAllConsistency();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function reconciliationHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const report = await reconcileFinancialIntegrity();
    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
}

export async function exportTransactionsCsvHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : undefined;
    const end = req.query.end ? new Date(String(req.query.end)) : undefined;

    const csv = await getTransactionsCsv(start, end);

    const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (error) {
    next(error);
  }
}
