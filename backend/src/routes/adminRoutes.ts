import { Router } from 'express';
import {
  getOverviewHandler,
  getCompaniesHandler,
  createCompanyHandler,
  getCompanyHandler,
  updateCompanyHandler,
  getCompanyEmployeesHandler,
  getCompanyTransactionsHandler,
  adjustBalanceHandler,
  getAllTransactionsHandler,
  getCompanyViewerHandler,
  updateCompanyViewerHandler,
  updateAdminEmployeeHandler,
  getSubscribersHandler,
  getCpfUserDetailHandler,
  updateCpfUserCardNumberHandler,
  searchByCardNumberHandler,
  registerPurchaseByCardHandler,
  checkConsistencyHandler,
  exportTransactionsCsvHandler,
  reconciliationHandler,
} from '../controllers/adminController.js';
import { authenticate, requireSuperAdmin, requirePasswordChanged } from '../middlewares/index.js';

const router = Router();

router.use(authenticate);
router.use(requirePasswordChanged);
router.use(requireSuperAdmin);

router.get('/overview', getOverviewHandler);
router.get('/transactions', getAllTransactionsHandler);
router.get('/subscribers', getSubscribersHandler);
router.get('/cpf-users/:id', getCpfUserDetailHandler);
router.put('/cpf-users/:id/card', updateCpfUserCardNumberHandler);

// Card-based purchase
router.get('/card/:cardNumber', searchByCardNumberHandler);
router.post('/purchase', registerPurchaseByCardHandler);

router.get('/companies', getCompaniesHandler);
router.post('/companies', createCompanyHandler);
router.get('/companies/:id', getCompanyHandler);
router.put('/companies/:id', updateCompanyHandler);
router.get('/companies/:id/employees', getCompanyEmployeesHandler);
router.get('/companies/:id/transactions', getCompanyTransactionsHandler);
router.get('/companies/:id/viewer', getCompanyViewerHandler);
router.put('/companies/:id/viewer', updateCompanyViewerHandler);

router.put('/employees/:id', updateAdminEmployeeHandler);
router.post('/employees/:id/adjust-balance', adjustBalanceHandler);

// Financial consistency check
router.get('/consistency-check', checkConsistencyHandler);

// Financial reconciliation
router.get('/reconciliation', reconciliationHandler);

// CSV export
router.get('/reports/transactions', exportTransactionsCsvHandler);

export default router;
