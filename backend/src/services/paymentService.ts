import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import {
  Payment,
  PaymentStatus,
  User,
  UserRole,
  Employee,
  LedgerTransaction,
  TransactionType,
} from '../models/index.js';
import { WalletOwnerType } from '../models/Wallet.js';
import { AuditLog, AuditAction } from '../models/AuditLog.js';
import * as mercadoPagoService from './mercadoPagoService.js';
import * as walletService from './walletService.js';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { Money } from '../utils/money.js';
import { assertFeatureEnabled } from '../config/featureFlags.js';

interface CreatePaymentInput {
  userId: string;
  role: UserRole;
  amount?: number;
  employeeId?: string;
  companyId?: string;
  employeeIds?: string[];
  amountPerEmployee?: number;
}

interface PaymentResponse {
  paymentId: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
  copiaECola: string;
  ticketUrl: string;
  status: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentResponse> {
  const {
    userId,
    role,
    amount: directAmount,
    companyId,
    employeeIds,
    amountPerEmployee,
  } = input;

  assertFeatureEnabled('ENABLE_PIX', role);

  let totalAmount: number;
  let description: string;

  if (role === UserRole.COMPANY_VIEWER) {
    if (!employeeIds || employeeIds.length === 0) {
      throw new BadRequestError('Selecione pelo menos um colaborador');
    }
    if (!amountPerEmployee || amountPerEmployee <= 0) {
      throw new BadRequestError('Valor por colaborador deve ser maior que zero');
    }

    const employees = await Employee.find({
      _id: { $in: employeeIds.map(id => new Types.ObjectId(id)) },
      companyId: new Types.ObjectId(companyId!),
      isActive: true,
    }).select('_id');

    if (employees.length !== employeeIds.length) {
      throw new BadRequestError('Um ou mais colaboradores selecionados são inválidos ou inativos');
    }

    // Use Money to avoid float-multiplication errors (e.g. 0.10 * 3 = 0.30000000000000004)
    totalAmount = Money.fromReais(amountPerEmployee).multiply(employeeIds.length).toReais();
    description = `Recarga via Pix - R$ ${amountPerEmployee.toFixed(2)} x ${employeeIds.length} colaborador(es)`;
  } else {
    if (!directAmount || directAmount <= 0) {
      throw new BadRequestError('Valor deve ser maior que zero');
    }
    totalAmount = directAmount;
    description = `Recarga de saldo via Pix - R$ ${totalAmount.toFixed(2)}`;
  }

  if (totalAmount > env.PIX_MAX_AMOUNT) {
    throw new BadRequestError(`Valor máximo permitido: R$ ${env.PIX_MAX_AMOUNT.toFixed(2)}`);
  }

  const idempotencyKey = crypto.randomUUID();

  const mpResult = await mercadoPagoService.createPixPayment(
    totalAmount,
    description,
    idempotencyKey
  );

  const isAlreadyApproved = mpResult.status === 'processed';

  const payment = await Payment.create({
    userId: new Types.ObjectId(userId),
    role,
    amount: totalAmount,
    amountPerEmployee: role === UserRole.COMPANY_VIEWER ? amountPerEmployee : undefined,
    employeeIds: role === UserRole.COMPANY_VIEWER
      ? employeeIds!.map(id => new Types.ObjectId(id))
      : undefined,
    provider: 'mercadopago',
    providerPaymentId: mpResult.orderId,
    status: PaymentStatus.PENDING,
    qrCode: mpResult.qrCode,
    qrCodeBase64: mpResult.qrCodeBase64,
    copiaECola: mpResult.qrCode,
    ticketUrl: mpResult.ticketUrl,
  });

  logger.info(
    { paymentId: payment._id, userId, role, amount: totalAmount, orderId: mpResult.orderId },
    'Payment created successfully'
  );

  // If MP already approved (e.g. test mode auto-approve), credit immediately
  if (isAlreadyApproved) {
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { processingAt: new Date() } }
    );
    await creditPayment(payment);
  }

  const finalStatus = isAlreadyApproved ? PaymentStatus.APPROVED : PaymentStatus.PENDING;

  return {
    paymentId: payment._id.toString(),
    amount: totalAmount,
    qrCode: mpResult.qrCode,
    qrCodeBase64: mpResult.qrCodeBase64,
    copiaECola: mpResult.qrCode,
    ticketUrl: mpResult.ticketUrl,
    status: finalStatus,
  };
}

export async function processWebhook(orderId: string): Promise<void> {
  const payment = await Payment.findOne({ providerPaymentId: orderId });

  if (!payment) {
    logger.warn({ orderId }, 'Webhook received for unknown order');
    return;
  }

  // Idempotency: already credited
  if (payment.status === PaymentStatus.APPROVED && payment.creditedAt) {
    logger.info({ orderId }, 'Webhook already processed (idempotent)');
    return;
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return;
  }

  const mpStatus = await mercadoPagoService.getOrderStatus(orderId);
  const isApproved = mpStatus.orderStatus === 'processed'
    || mpStatus.paymentStatus === 'approved';

  if (isApproved) {
    // Acquire atomic processingAt lock to prevent concurrent double-crediting
    const locked = await Payment.findOneAndUpdate(
      { _id: payment._id, status: PaymentStatus.PENDING, processingAt: null },
      { $set: { processingAt: new Date() } },
      { new: false }
    );

    if (!locked) {
      logger.warn({ orderId }, 'Could not acquire processingAt lock — already processing or approved');
      return;
    }

    await creditPayment(locked);
  } else {
    const statusMap: Record<string, PaymentStatus> = {
      action_required: PaymentStatus.PENDING,
      expired: PaymentStatus.EXPIRED,
      cancelled: PaymentStatus.CANCELLED,
      pending: PaymentStatus.PENDING,
      rejected: PaymentStatus.REJECTED,
    };
    payment.status = statusMap[mpStatus.paymentStatus] || statusMap[mpStatus.orderStatus] || PaymentStatus.PENDING;
    await payment.save();

    logger.info(
      { orderId, newStatus: payment.status, orderStatus: mpStatus.orderStatus, paymentStatus: mpStatus.paymentStatus },
      'Payment status updated'
    );
  }
}

/**
 * Credit a payment atomically using a MongoDB session (transaction).
 * All operations — wallet credit, ledger creation, payment status update, audit log —
 * are executed inside a single withTransaction block. If any step fails, all changes
 * are rolled back automatically.
 */
async function creditPayment(payment: InstanceType<typeof Payment>): Promise<void> {
  const { role, userId, amount } = payment;
  const batchId = `pix-${payment._id.toString()}`;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      if (role === UserRole.EMPLOYEE) {
        const user = await User.findById(userId).select('employeeId').session(session);
        if (!user?.employeeId) {
          throw new Error(`Employee user has no employeeId: userId=${userId}`);
        }

        const employee = await Employee.findById(user.employeeId).select('isActive companyId').session(session);
        if (!employee || !employee.isActive) {
          throw new Error(`Employee not found or inactive: employeeId=${user.employeeId}`);
        }

        const { balanceBefore, balanceAfter } = await walletService.creditWallet(
          WalletOwnerType.EMPLOYEE,
          employee._id,
          amount,
          session
        );

        await LedgerTransaction.create([{
          employeeId: employee._id,
          companyId: employee.companyId,
          type: TransactionType.DEPOSIT,
          amount,
          balanceBefore,
          balanceAfter,
          description: `Recarga via Pix - R$ ${amount.toFixed(2)}`,
          performedBy: userId,
          idempotencyKey: `pix-credit-${payment._id.toString()}`,
        }], { session });

      } else if (role === UserRole.CPF_USER) {
        const user = await User.findById(userId).select('isActive').session(session);
        if (!user || !user.isActive) {
          throw new Error(`CPF user not found or inactive: userId=${userId}`);
        }

        const { balanceBefore, balanceAfter } = await walletService.creditWallet(
          WalletOwnerType.CPF_USER,
          user._id,
          amount,
          session
        );

        await LedgerTransaction.create([{
          cpfUserId: user._id,
          type: TransactionType.DEPOSIT,
          amount,
          balanceBefore,
          balanceAfter,
          description: `Recarga via Pix - R$ ${amount.toFixed(2)}`,
          performedBy: userId,
          idempotencyKey: `pix-credit-${payment._id.toString()}`,
        }], { session });

      } else if (role === UserRole.COMPANY_VIEWER) {
        const { employeeIds, amountPerEmployee } = payment;

        if (!employeeIds || !amountPerEmployee) {
          throw new Error(`Company payment missing employeeIds or amountPerEmployee: paymentId=${payment._id}`);
        }

        const employees = await Employee.find(
          { _id: { $in: employeeIds }, isActive: true },
          null,
          { session }
        );

        for (const employee of employees) {
          const { balanceBefore, balanceAfter } = await walletService.creditWallet(
            WalletOwnerType.EMPLOYEE,
            employee._id,
            amountPerEmployee,
            session
          );

          await LedgerTransaction.create([{
            employeeId: employee._id,
            companyId: employee.companyId,
            type: TransactionType.DEPOSIT,
            amount: amountPerEmployee,
            balanceBefore,
            balanceAfter,
            description: `Recarga via Pix - R$ ${amountPerEmployee.toFixed(2)} (${employees.length} colaboradores)`,
            performedBy: userId,
            batchId,
            idempotencyKey: `pix-credit-${payment._id.toString()}-${employee._id.toString()}`,
          }], { session });
        }
      }

      // Mark as approved inside the transaction
      await Payment.findOneAndUpdate(
        { _id: payment._id },
        { $set: { status: PaymentStatus.APPROVED, creditedAt: new Date() } },
        { session }
      );

      // Audit log inside the transaction
      await AuditLog.create([{
        actorUserId: userId,
        action: AuditAction.PIX_CREDIT,
        targetType: 'Payment',
        targetId: payment._id,
        metadata: { amount, role, batchId },
      }], { session });
    });

    logger.info(
      { paymentId: payment._id, userId, role, amount },
      'Payment credited successfully'
    );
  } catch (error) {
    // Release lock on transaction failure so the webhook can be retried
    await Payment.updateOne({ _id: payment._id }, { $unset: { processingAt: 1 } }).catch(() => {});
    logger.error({ paymentId: payment._id, err: error }, 'creditPayment transaction failed — lock released');
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function getPaymentById(
  paymentId: string,
  userId: string
): Promise<InstanceType<typeof Payment>> {
  const payment = await Payment.findOne({
    _id: new Types.ObjectId(paymentId),
    userId: new Types.ObjectId(userId),
  });

  if (!payment) {
    throw new NotFoundError('Pagamento não encontrado');
  }

  return payment;
}

/**
 * Check payment status by polling the MP Orders API and updating local status.
 */
export async function checkAndUpdatePaymentStatus(
  paymentId: string,
  userId: string
): Promise<{ status: PaymentStatus }> {
  const payment = await Payment.findOne({
    _id: new Types.ObjectId(paymentId),
    userId: new Types.ObjectId(userId),
  });

  if (!payment) {
    throw new NotFoundError('Pagamento não encontrado');
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return { status: payment.status };
  }

  if (payment.providerPaymentId) {
    try {
      const mpStatus = await mercadoPagoService.getOrderStatus(payment.providerPaymentId);

      const isApproved = mpStatus.orderStatus === 'processed'
        || mpStatus.paymentStatus === 'approved';

      if (isApproved && !payment.creditedAt) {
        const locked = await Payment.findOneAndUpdate(
          { _id: payment._id, status: PaymentStatus.PENDING, processingAt: null },
          { $set: { processingAt: new Date() } },
          { new: false }
        );

        if (!locked) {
          return { status: payment.status };
        }

        await creditPayment(locked);
        return { status: PaymentStatus.APPROVED };
      }

      const statusMap: Record<string, PaymentStatus> = {
        expired: PaymentStatus.EXPIRED,
        cancelled: PaymentStatus.CANCELLED,
        rejected: PaymentStatus.REJECTED,
      };

      const newStatus = statusMap[mpStatus.paymentStatus] || statusMap[mpStatus.orderStatus];
      if (newStatus && newStatus !== payment.status) {
        payment.status = newStatus;
        await payment.save();
      }
    } catch (error) {
      logger.warn({ paymentId, error }, 'Failed to poll MP order status');
    }
  }

  return { status: payment.status };
}

export async function getUserPayments(
  userId: string,
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    Payment.find({ userId: new Types.ObjectId(userId) })
      .select('amount status provider createdAt expirationTime amountPerEmployee employeeIds')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments({ userId: new Types.ObjectId(userId) }),
  ]);

  return {
    payments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
