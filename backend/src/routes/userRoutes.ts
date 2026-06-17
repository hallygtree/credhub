import { Router } from 'express';
import { authenticate, requireUser, requirePasswordChanged } from '../middlewares/index.js';
import {
  getUserMeHandler,
  getUserBalanceHandler,
  getUserTransactionsHandler,
  updateUserMeHandler,
} from '../controllers/userController.js';

const router = Router();

// All routes require authentication, password changed, and EMPLOYEE or CPF_USER role
router.use(authenticate, requirePasswordChanged, requireUser);

// GET /user/me - Get own profile
router.get('/me', getUserMeHandler);

// PUT /user/me - Update own profile
router.put('/me', updateUserMeHandler);

// GET /user/balance - Get own balance
router.get('/balance', getUserBalanceHandler);

// GET /user/transactions - Get own transaction history
router.get('/transactions', getUserTransactionsHandler);

export default router;
