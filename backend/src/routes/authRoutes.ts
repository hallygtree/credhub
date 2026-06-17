import { Router } from 'express';
import { loginHandler, getMeHandler, changePasswordHandler, updateEmailHandler, registerCpfUserHandler } from '../controllers/authController.js';
import { authenticate, loginRateLimiter, requirePasswordChanged } from '../middlewares/index.js';

const router = Router();

// Public routes
router.post('/login', loginRateLimiter, loginHandler);
router.post('/register', loginRateLimiter, registerCpfUserHandler);

// Authenticated routes
router.get('/me', authenticate, getMeHandler);

// Password change - allowed even with mustChangePassword=true
router.post('/change-password', authenticate, changePasswordHandler);

// Email update - requires password already changed
router.put('/email', authenticate, requirePasswordChanged, updateEmailHandler);

export default router;
