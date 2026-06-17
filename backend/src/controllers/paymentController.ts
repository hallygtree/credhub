import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { UserRole } from '../models/index.js';
import { ProcessedWebhookEvent } from '../models/ProcessedWebhookEvent.js';
import * as paymentService from '../services/paymentService.js';
import * as mercadoPagoService from '../services/mercadoPagoService.js';
import { createPixPaymentSchema, createCompanyPixPaymentSchema } from '../validators/payment.js';
import { logger } from '../utils/logger.js';

export async function createPixPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id: userId, role, employeeId, companyId } = authReq.user!;

    let result;

    if (role === UserRole.COMPANY_VIEWER) {
      const validated = createCompanyPixPaymentSchema.parse(req.body);

      result = await paymentService.createPayment({
        userId: userId.toString(),
        role,
        companyId: companyId?.toString(),
        employeeIds: validated.employeeIds,
        amountPerEmployee: validated.amountPerEmployee,
      });
    } else {
      const validated = createPixPaymentSchema.parse(req.body);

      result = await paymentService.createPayment({
        userId: userId.toString(),
        role,
        amount: validated.amount,
        employeeId: employeeId?.toString(),
      });
    }

    sendCreated(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getPaymentStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id: userId } = authReq.user!;
    const { id: paymentId } = req.params;

    const result = await paymentService.checkAndUpdatePaymentStatus(
      paymentId as string,
      userId.toString()
    );

    sendSuccess(res, { status: result.status });
  } catch (error) {
    next(error);
  }
}

export async function getUserPaymentsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id: userId } = authReq.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await paymentService.getUserPayments(userId.toString(), page, limit);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function webhookHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const xSignature = req.headers['x-signature'] as string | undefined;
    const xRequestId = req.headers['x-request-id'] as string | undefined;

    const { action, data, type } = req.body;

    const isRelevant = type === 'payment' || type === 'order'
      || action === 'payment.updated' || action === 'payment.created'
      || action === 'order.updated' || action === 'order.created';

    if (isRelevant) {
      const dataId = data?.id ? String(data.id) : '';

      const isValid = mercadoPagoService.validateWebhookSignature(
        xSignature,
        xRequestId,
        dataId
      );

      if (!isValid) {
        logger.warn({ xSignature, xRequestId, dataId }, 'Invalid webhook signature');
        res.status(401).json({ success: false, error: 'Invalid signature' });
        return;
      }

      if (dataId) {
        // Webhook-level idempotency: deduplicate by provider + action + dataId
        const eventId = `${action || type || 'event'}-${dataId}`;

        const alreadyProcessed = await ProcessedWebhookEvent.findOne({
          provider: 'mercadopago',
          eventId,
        });

        if (alreadyProcessed) {
          logger.info({ eventId }, 'Duplicate webhook event — skipping (already processed)');
        } else {
          await paymentService.processWebhook(dataId);

          // Record event to prevent future duplicates (ignore insert errors on race condition)
          await ProcessedWebhookEvent.create({
            provider: 'mercadopago',
            eventId,
            paymentProviderId: dataId,
          }).catch(() => {});
        }
      }
    }

    // Always respond 200 to Mercado Pago to avoid retries
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Webhook processing error');
    res.status(200).json({ success: true });
  }
}
