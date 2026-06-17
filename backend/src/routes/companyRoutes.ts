import { Router } from 'express';
import {
  getCompanyOverviewHandler,
  createMyEmployeeHandler,
  getMyCompanyEmployeesHandler,
  getEmployeeDetailHandler,
  getMyCompanyTransactionsHandler,
  updateMyEmployeeHandler,
  deleteMyEmployeeHandler,
  reloadBalancesHandler,
} from '../controllers/companyController.js';
import { authenticate, requireRole, requirePasswordChanged } from '../middlewares/index.js';
import { UserRole } from '../models/index.js';

const router = Router();

router.use(authenticate);
router.use(requirePasswordChanged);
router.use(requireRole(UserRole.COMPANY_VIEWER));

router.get('/overview', getCompanyOverviewHandler);

router.get('/employees', getMyCompanyEmployeesHandler);
router.post('/employees', createMyEmployeeHandler);
router.get('/employees/:id', getEmployeeDetailHandler);
router.put('/employees/:id', updateMyEmployeeHandler);
router.delete('/employees/:id', deleteMyEmployeeHandler);
router.post('/employees/reload-balances', reloadBalancesHandler);
router.get('/transactions', getMyCompanyTransactionsHandler);

export default router;
