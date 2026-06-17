import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import companyRoutes from './companyRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import userRoutes from './userRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import webhookRoutes from './webhookRoutes.js';

const router = Router();
const startTime = Date.now();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/company', companyRoutes);
router.use('/employee', employeeRoutes);
router.use('/user', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/webhooks', webhookRoutes);

router.get('/health', (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';
  const isHealthy = mongoState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    mongodb: mongoStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
