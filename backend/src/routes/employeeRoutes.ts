import { Router } from 'express';
import { authenticate, requireEmployee, requirePasswordChanged } from '../middlewares/index.js';
import {
  getEmployeeMeHandler,
  getEmployeeBalanceHandler,
  getEmployeeTransactionsHandler,
  updateEmployeeMeHandler,
} from '../controllers/employeeController.js';

const router = Router();

// All routes require authentication, password changed, and EMPLOYEE role
router.use(authenticate, requirePasswordChanged, requireEmployee);

// GET /employee/me - Get own profile (LGPD-compliant, minimal data)
router.get('/me', getEmployeeMeHandler);

// PUT /employee/me - Update own profile (name only)
router.put('/me', updateEmployeeMeHandler);

// GET /employee/balance - Get own balance
router.get('/balance', getEmployeeBalanceHandler);

// GET /employee/transactions - Get own transaction history
router.get('/transactions', getEmployeeTransactionsHandler);

export default router;
