import mongoose, { Types } from 'mongoose';
import { AuditAction, AuditLog, Company, Employee, LedgerTransaction, Payment, PaymentStatus, TransactionType, User, UserRole } from '../models/index.js';
import { Wallet, WalletOwnerType } from '../models/Wallet.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { maskCpf, maskCnpj, maskCardNumber } from '../utils/mask.js';
import { assertFeatureEnabled } from '../config/featureFlags.js';
import * as walletService from './walletService.js';

export interface AdminOverview {
  totalCompanies: number;
  activeCompanies: number;
  totalEmployees: number;
  activeEmployees: number;
  totalCpfUsers: number;
  activeCpfUsers: number;
  totalBalance: number;
  recentTransactions: number;
  transactionsByType: {
    deposits: number;
    consumes: number;
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    totalCompanies,
    activeCompanies,
    totalEmployees,
    activeEmployees,
    totalCpfUsers,
    activeCpfUsers,
    employeeWalletAgg,
    cpfUserWalletAgg,
    recentTransactions,
    transactionsByType,
  ] = await Promise.all([
    Company.countDocuments(),
    Company.countDocuments({ isActive: true }),
    Employee.countDocuments(),
    Employee.countDocuments({ isActive: true }),
    User.countDocuments({ role: UserRole.CPF_USER }),
    User.countDocuments({ role: UserRole.CPF_USER, isActive: true }),
    // Wallet is the single source of truth for balance aggregation
    Wallet.aggregate([
      { $match: { ownerType: WalletOwnerType.EMPLOYEE, isActive: true } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]),
    Wallet.aggregate([
      { $match: { ownerType: WalletOwnerType.CPF_USER, isActive: true } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]),
    LedgerTransaction.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
    LedgerTransaction.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const typeMap: Record<string, number> = {};
  transactionsByType.forEach((item: { _id: string; count: number }) => {
    typeMap[item._id] = item.count;
  });

  const employeeBalance = employeeWalletAgg[0]?.total || 0;
  const cpfUserBalance = cpfUserWalletAgg[0]?.total || 0;

  return {
    totalCompanies,
    activeCompanies,
    totalEmployees,
    activeEmployees,
    totalCpfUsers,
    activeCpfUsers,
    totalBalance: employeeBalance + cpfUserBalance,
    recentTransactions,
    transactionsByType: {
      deposits: typeMap[TransactionType.DEPOSIT] || 0,
      consumes: typeMap[TransactionType.CONSUME] || 0,
    },
  };
}

export async function getRecentActivity(limit = 10) {
  const transactions = await LedgerTransaction.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('employeeId', 'name email')
    .populate('companyId', 'name')
    .populate('performedBy', 'name');

  return transactions;
}

export async function getAllTransactions(page = 1, limit = 100) {
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    LedgerTransaction.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employeeId', 'name email')
      .populate('cpfUserId', 'name email')
      .populate('companyId', 'name')
      .populate('performedBy', 'name'),
    LedgerTransaction.countDocuments(),
  ]);

  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export interface Subscriber {
  id: string;
  type: 'COMPANY' | 'CPF_USER';
  name: string;
  document: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  cardNumber?: string;
}


export async function getSubscribers(): Promise<Subscriber[]> {
  const [companies, cpfUsers] = await Promise.all([
    Company.find().select('name cnpj email isActive createdAt').lean(),
    User.find({ role: UserRole.CPF_USER }).select('name cpf email isActive createdAt cardNumber').lean(),
  ]);

  const subscribers: Subscriber[] = [];

  for (const company of companies) {
    subscribers.push({
      id: company._id.toString(),
      type: 'COMPANY',
      name: company.name,
      document: maskCnpj(company.cnpj),
      email: company.email,
      isActive: company.isActive,
      createdAt: company.createdAt,
    });
  }

  for (const user of cpfUsers) {
    subscribers.push({
      id: user._id.toString(),
      type: 'CPF_USER',
      name: user.name,
      document: maskCpf(user.cpf || ''),
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      cardNumber: user.cardNumber,
    });
  }

  subscribers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return subscribers;
}

export interface CpfUserDetail {
  id: string;
  name: string;
  email: string;
  cpf: string;
  cardNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  balance: number;
}

export async function getCpfUserDetail(id: string): Promise<{ user: CpfUserDetail; transactions: object[] }> {
  const user = await User.findOne({ _id: id, role: UserRole.CPF_USER });

  if (!user) {
    throw new NotFoundError('Usuário CPF não encontrado');
  }

  const [wallet, transactions] = await Promise.all([
    Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id }).lean(),
    LedgerTransaction.find({ cpfUserId: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      cpf: maskCpf(user.cpf || ''),
      cardNumber: user.cardNumber || null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      balance: wallet?.balance || 0,
    },
    transactions,
  };
}

export async function updateCpfUserCardNumber(
  userId: string,
  cardNumber: string | null
): Promise<{ id: string; cardNumber: string | null }> {
  const user = await User.findOne({ _id: userId, role: UserRole.CPF_USER });

  if (!user) {
    throw new NotFoundError('CPF user not found');
  }

  if (cardNumber) {
    const existingUser = await User.findOne({
      cardNumber,
      _id: { $ne: userId },
    });
    if (existingUser) {
      throw new ConflictError('Numero do cartao ja esta em uso');
    }

    const existingEmployee = await Employee.findOne({ cardNumber });
    if (existingEmployee) {
      throw new ConflictError('Numero do cartao ja esta em uso');
    }
  }

  user.cardNumber = cardNumber || undefined;
  await user.save();

  logger.info({ userId, cardNumber: maskCardNumber(cardNumber ?? '') }, 'CPF user card number updated');

  return {
    id: user._id.toString(),
    cardNumber: user.cardNumber || null,
  };
}

export interface CardHolder {
  id: string;
  type: 'EMPLOYEE' | 'CPF_USER';
  name: string;
  balance: number;
  cardNumber: string;
  companyName?: string;
}

export async function searchByCardNumber(searchTerm: string): Promise<CardHolder[]> {
  const results: CardHolder[] = [];
  const regex = new RegExp(searchTerm, 'i');

  const employees = await Employee.find({
    $or: [
      { cardNumber: { $regex: regex } },
      { name: { $regex: regex } },
    ],
    isActive: true,
    cardNumber: { $nin: [null, ''] },
  })
    .populate('companyId', 'name')
    .limit(10)
    .lean();

  for (const employee of employees) {
    const companyData = employee.companyId as unknown as { name: string } | null;
    const balance = await walletService.getWalletBalance(
      WalletOwnerType.EMPLOYEE,
      employee._id as Types.ObjectId
    );
    results.push({
      id: employee._id.toString(),
      type: 'EMPLOYEE',
      name: employee.name,
      balance,
      cardNumber: employee.cardNumber!,
      companyName: companyData?.name,
    });
  }

  const cpfUsers = await User.find({
    $or: [
      { cardNumber: { $regex: regex } },
      { name: { $regex: regex } },
    ],
    role: UserRole.CPF_USER,
    isActive: true,
    cardNumber: { $nin: [null, ''] },
  })
    .limit(10)
    .lean();

  for (const cpfUser of cpfUsers) {
    const balance = await walletService.getWalletBalance(
      WalletOwnerType.CPF_USER,
      cpfUser._id as Types.ObjectId
    );
    results.push({
      id: cpfUser._id.toString(),
      type: 'CPF_USER',
      name: cpfUser.name,
      balance,
      cardNumber: cpfUser.cardNumber!,
    });
  }

  return results;
}

export async function registerPurchaseByCard(
  cardNumber: string,
  amount: number,
  description: string,
  performedByUserId: Types.ObjectId,
  actorRole?: UserRole
): Promise<{ holder: CardHolder; transaction: typeof LedgerTransaction.prototype }> {
  assertFeatureEnabled('ENABLE_CONSUME', actorRole);

  if (!cardNumber || !cardNumber.trim()) {
    throw new BadRequestError('Número do cartão é obrigatório');
  }

  if (amount <= 0) {
    throw new BadRequestError('O valor deve ser maior que zero');
  }

  // Lookup holder outside transaction (read-only, no side-effects)
  const employee = await Employee.findOne({ cardNumber, isActive: true });

  if (employee) {
    const session = await mongoose.startSession();
    let resultTransaction: typeof LedgerTransaction.prototype;
    let balanceAfterResult: number;

    try {
      await session.withTransaction(async () => {
        const { balanceBefore, balanceAfter } = await walletService.debitWallet(
          WalletOwnerType.EMPLOYEE,
          employee._id,
          amount,
          session
        );
        balanceAfterResult = balanceAfter;

        const [tx] = await LedgerTransaction.create([{
          employeeId: employee._id,
          companyId: employee.companyId,
          type: TransactionType.CONSUME,
          amount: -amount,
          balanceBefore,
          balanceAfter,
          description,
          performedBy: performedByUserId,
        }], { session });

        await AuditLog.create([{
          actorUserId: performedByUserId,
          action: AuditAction.PURCHASE_BY_CARD,
          targetType: 'Employee',
          targetId: employee._id,
          metadata: { cardNumber: maskCardNumber(cardNumber), amount, balanceBefore, balanceAfter },
        }], { session });

        resultTransaction = tx;
      });
    } finally {
      await session.endSession();
    }

    const company = await Company.findById(employee.companyId).select('name').lean();

    logger.info(
      { cardNumber: maskCardNumber(cardNumber), employeeId: employee._id, amount, balanceAfter: balanceAfterResult! },
      'Purchase registered by card number (employee)'
    );

    return {
      holder: {
        id: employee._id.toString(),
        type: 'EMPLOYEE',
        name: employee.name,
        balance: balanceAfterResult!,
        cardNumber,
        companyName: company?.name,
      },
      transaction: resultTransaction!,
    };
  }

  const cpfUser = await User.findOne({
    cardNumber,
    role: UserRole.CPF_USER,
    isActive: true,
  });

  if (cpfUser) {
    const session = await mongoose.startSession();
    let resultTransaction: typeof LedgerTransaction.prototype;
    let balanceAfterResult: number;

    try {
      await session.withTransaction(async () => {
        const { balanceBefore, balanceAfter } = await walletService.debitWallet(
          WalletOwnerType.CPF_USER,
          cpfUser._id,
          amount,
          session
        );
        balanceAfterResult = balanceAfter;

        const [tx] = await LedgerTransaction.create([{
          cpfUserId: cpfUser._id,
          type: TransactionType.CONSUME,
          amount: -amount,
          balanceBefore,
          balanceAfter,
          description,
          performedBy: performedByUserId,
        }], { session });

        await AuditLog.create([{
          actorUserId: performedByUserId,
          action: AuditAction.PURCHASE_BY_CARD,
          targetType: 'CpfUser',
          targetId: cpfUser._id,
          metadata: { cardNumber: maskCardNumber(cardNumber), amount, balanceBefore, balanceAfter },
        }], { session });

        resultTransaction = tx;
      });
    } finally {
      await session.endSession();
    }

    logger.info(
      { cardNumber: maskCardNumber(cardNumber), cpfUserId: cpfUser._id, amount, balanceAfter: balanceAfterResult! },
      'Purchase registered by card number (CPF user)'
    );

    return {
      holder: {
        id: cpfUser._id.toString(),
        type: 'CPF_USER',
        name: cpfUser.name,
        balance: balanceAfterResult!,
        cardNumber,
      },
      transaction: resultTransaction!,
    };
  }

  throw new NotFoundError('Cartao nao encontrado ou usuario inativo');
}

// ─── Financial Consistency Check ─────────────────────────────────────────────

export interface ConsistencyResult {
  ownerId: string;
  ownerType: WalletOwnerType;
  walletBalance: number;
  ledgerBalance: number;
  isConsistent: boolean;
  divergence: number;
}

/**
 * Recalculate balance for a single owner by summing LedgerTransaction amounts
 * and comparing against Wallet.balance.
 */
export async function recalculateBalance(
  ownerId: string,
  ownerType: WalletOwnerType
): Promise<ConsistencyResult> {
  const ownerObjectId = new Types.ObjectId(ownerId);

  const matchField = ownerType === WalletOwnerType.EMPLOYEE
    ? { employeeId: ownerObjectId }
    : { cpfUserId: ownerObjectId };

  const agg = await LedgerTransaction.aggregate([
    { $match: matchField },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const ledgerBalance = agg[0]?.total ?? 0;
  const walletBalance = await walletService.getWalletBalance(ownerType, ownerObjectId);
  const divergence = parseFloat((walletBalance - ledgerBalance).toFixed(2));

  return {
    ownerId,
    ownerType,
    walletBalance,
    ledgerBalance,
    isConsistent: Math.abs(divergence) < 0.01,
    divergence,
  };
}

/**
 * Run consistency check across all wallets and return any divergences.
 */
export async function checkAllConsistency(): Promise<{
  total: number;
  inconsistent: number;
  results: ConsistencyResult[];
}> {
  const wallets = await Wallet.find({ isActive: true }).select('ownerId ownerType').lean();

  const results = await Promise.all(
    wallets.map(w => recalculateBalance(w.ownerId.toString(), w.ownerType))
  );

  const inconsistentResults = results.filter(r => !r.isConsistent);

  return {
    total: wallets.length,
    inconsistent: inconsistentResults.length,
    results: inconsistentResults,
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV string of all ledger transactions within an optional date range.
 */
export async function getTransactionsCsv(startDate?: Date, endDate?: Date): Promise<string> {
  const query: Record<string, unknown> = {};
  if (startDate || endDate) {
    query.createdAt = {
      ...(startDate ? { $gte: startDate } : {}),
      ...(endDate ? { $lte: endDate } : {}),
    };
  }

  const transactions = await LedgerTransaction.find(query)
    .sort({ createdAt: -1 })
    .populate('employeeId', 'name')
    .populate('cpfUserId', 'name')
    .populate('companyId', 'name')
    .lean();

  const header = 'Nome,Empresa,Tipo,Valor,Saldo Antes,Saldo Depois,Data';
  const rows = transactions.map(tx => {
    const name = escapeCsv((tx.employeeId as any)?.name || (tx.cpfUserId as any)?.name || 'N/A');
    const company = escapeCsv((tx.companyId as any)?.name || 'Avulso');
    const type = tx.type;
    const amount = tx.amount.toFixed(2);
    const before = tx.balanceBefore.toFixed(2);
    const after = tx.balanceAfter.toFixed(2);
    const date = new Date(tx.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return `${name},${company},${type},${amount},${before},${after},${escapeCsv(date)}`;
  });

  return [header, ...rows].join('\n');
}

// ─── Financial Reconciliation ─────────────────────────────────────────────────

export interface ReconciliationReport {
  generatedAt: string;
  negativeWallets: {
    ownerId: string;
    ownerType: WalletOwnerType;
    balance: number;
  }[];
  orphanPayments: {
    paymentId: string;
    amount: number;
    approvedAt: Date | undefined;
  }[];
  balanceDivergences: ConsistencyResult[];
  summary: {
    totalWallets: number;
    negativeWalletCount: number;
    orphanPaymentCount: number;
    divergenceCount: number;
    isHealthy: boolean;
  };
}

/**
 * Full financial reconciliation:
 *  1. Detect wallets with negative balance
 *  2. Detect approved Payments with no matching LedgerTransaction (orphan)
 *  3. Detect wallets where Wallet.balance ≠ sum(LedgerTransactions)
 */
export async function reconcileFinancialIntegrity(): Promise<ReconciliationReport> {
  // 1 — Negative wallets
  const negativeWalletDocs = await Wallet.find({ balance: { $lt: 0 }, isActive: true })
    .select('ownerId ownerType balance')
    .lean();

  const negativeWallets = negativeWalletDocs.map(w => ({
    ownerId: w.ownerId.toString(),
    ownerType: w.ownerType,
    balance: w.balance,
  }));

  // 2 — Orphan payments: approved Payments with creditedAt but no LedgerTransaction
  //     An approved PIX payment should always produce at least one LedgerTransaction
  //     whose idempotencyKey starts with "pix-credit-<paymentId>"
  const approvedPayments = await Payment.find({ status: PaymentStatus.APPROVED, creditedAt: { $ne: null } })
    .select('_id amount creditedAt')
    .lean();

  const orphanPayments: ReconciliationReport['orphanPayments'] = [];
  for (const pmt of approvedPayments) {
    const prefix = `pix-credit-${pmt._id.toString()}`;
    const count = await LedgerTransaction.countDocuments({
      idempotencyKey: { $regex: `^${prefix}` },
    });
    if (count === 0) {
      orphanPayments.push({
        paymentId: pmt._id.toString(),
        amount: pmt.amount,
        approvedAt: pmt.creditedAt as Date | undefined,
      });
    }
  }

  // 3 — Balance divergences (wallet vs. ledger sum)
  const consistencyResult = await checkAllConsistency();

  const summary = {
    totalWallets: consistencyResult.total,
    negativeWalletCount: negativeWallets.length,
    orphanPaymentCount: orphanPayments.length,
    divergenceCount: consistencyResult.inconsistent,
    isHealthy:
      negativeWallets.length === 0 &&
      orphanPayments.length === 0 &&
      consistencyResult.inconsistent === 0,
  };

  logger.info(summary, 'Financial reconciliation completed');

  return {
    generatedAt: new Date().toISOString(),
    negativeWallets,
    orphanPayments,
    balanceDivergences: consistencyResult.results,
    summary,
  };
}
