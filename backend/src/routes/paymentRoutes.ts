import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../middlewares/index.js';
import { pixRateLimiter } from '../middlewares/rateLimiter.js';
import { UserRole } from '../models/index.js';
import {
  createPixPaymentHandler,
  getPaymentStatusHandler,
  getUserPaymentsHandler,
} from '../controllers/paymentController.js';

const router = Router();

// All routes require auth + password changed
router.use(authenticate, requirePasswordChanged);

// POST /payments/pix - Create a Pix payment (CPF_USER or COMPANY_VIEWER for batch employee recharge)
router.post('/pix', requireRole(UserRole.CPF_USER, UserRole.COMPANY_VIEWER), pixRateLimiter, createPixPaymentHandler);

// GET /payments/:id/status - Get payment status
router.get('/:id/status', requireRole(UserRole.EMPLOYEE, UserRole.CPF_USER, UserRole.COMPANY_VIEWER), getPaymentStatusHandler);

// GET /payments - List user's payments
router.get('/', requireRole(UserRole.EMPLOYEE, UserRole.CPF_USER, UserRole.COMPANY_VIEWER), getUserPaymentsHandler);

export default router;
