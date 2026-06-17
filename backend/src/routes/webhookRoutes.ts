import { Router } from 'express';
import { webhookHandler } from '../controllers/paymentController.js';

const router = Router();

// POST /webhooks/mercadopago - Mercado Pago webhook (NO JWT auth - external webhook)
router.post('/mercadopago', webhookHandler);

export default router;
