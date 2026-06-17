import mongoose, { Types } from 'mongoose';
import { Employee, IEmployee, LedgerTransaction, TransactionType, Company, User, UserRole, AuditLog, AuditAction } from '../models/index.js';
import { Wallet, WalletOwnerType } from '../models/Wallet.js';
import { toCompanyEmployeeDTO, CompanyEmployeeDTO, toEmployeeSelfDTO, EmployeeSelfDTO } from '../dto/index.js';
import { CreateEmployeeInput, AdjustBalanceInput } from '../validators/index.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { maskCardNumber } from '../utils/mask.js';
import { assertFeatureEnabled } from '../config/featureFlags.js';
import * as walletService from './walletService.js';

export async function createEmployee(input: CreateEmployeeInput): Promise<IEmployee> {
  const company = await Company.findById(input.companyId);
  if (!company || !company.isActive) {
    throw new NotFoundError('Company not found or inactive');
  }

  const existingEmployee = await Employee.findOne({
    $or: [{ email: input.email }, { cpf: input.cpf }],
  });

  if (existingEmployee) {
    throw new ConflictError('Employee with this email or CPF already exists');
  }

  const existingUser = await User.findOne({ email: input.email });
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  const employee = await Employee.create({
    name: input.name,
    email: input.email,
    cpf: input.cpf,
    phone: input.phone,
    companyId: new Types.ObjectId(input.companyId),
    balance: 0,
  });

  // Create wallet for the new employee
  await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);

  await User.create({
    email: input.email,
    password: input.password,
    name: input.name,
    role: UserRole.EMPLOYEE,
    companyId: new Types.ObjectId(input.companyId),
    employeeId: employee._id,
  });

  logger.info({ employeeId: employee._id, companyId: input.companyId }, 'Employee and user created');

  return employee;
}

export async function getEmployeesByCompany(
  companyId: string,
  page = 1,
  limit = 20,
  search?: string
): Promise<{ employees: IEmployee[]; total: number; page: number; totalPages: number }> {
  const query: Record<string, unknown> = { companyId: new Types.ObjectId(companyId) };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { cardNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [employees, total] = await Promise.all([
    Employee.find(query).sort({ name: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(query),
  ]);

  // Hydrate balance from Wallet (single source of truth)
  const employeeIds = employees.map(e => e._id);
  const wallets = await Wallet.find({
    ownerType: WalletOwnerType.EMPLOYEE,
    ownerId: { $in: employeeIds },
  }).select('ownerId balance');

  const walletMap = new Map(wallets.map(w => [w.ownerId.toString(), w.balance]));

  const hydratedEmployees = employees.map(e => {
    const obj = e.toObject();
    obj.balance = walletMap.get(e._id.toString()) ?? 0;
    return obj as IEmployee;
  });

  return {
    employees: hydratedEmployees,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// For COMPANY_VIEWER: returns employees without balance
export async function getEmployeesByCompanyForViewer(
  companyId: string,
  page = 1,
  limit = 20,
  search?: string
): Promise<{ employees: CompanyEmployeeDTO[]; total: number; page: number; totalPages: number }> {
  const query: Record<string, unknown> = { companyId: new Types.ObjectId(companyId) };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { cardNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [employees, total] = await Promise.all([
    Employee.find(query).sort({ name: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(query),
  ]);

  return {
    employees: employees.map(toCompanyEmployeeDTO),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getEmployeeById(
  employeeId: string,
  companyId?: string
): Promise<IEmployee> {
  const query: Record<string, unknown> = { _id: employeeId };

  if (companyId) {
    query.companyId = new Types.ObjectId(companyId);
  }

  const employee = await Employee.findOne(query).populate('companyId', 'name');

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  return employee;
}

/**
 * Soft-delete an employee: sets isActive=false on Employee, User and Wallet.
 * Financial history (LedgerTransaction) is preserved for audit purposes.
 */
export async function deleteEmployee(
  employeeId: string,
  companyId?: string
): Promise<void> {
  const query: Record<string, unknown> = { _id: employeeId };
  if (companyId) {
    query.companyId = new Types.ObjectId(companyId);
  }

  const employee = await Employee.findOne(query);

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!employee.isActive) {
    throw new BadRequestError('Employee is already inactive');
  }

  await Promise.all([
    Employee.updateOne({ _id: employee._id }, { isActive: false }),
    User.updateOne({ employeeId: employee._id }, { isActive: false }),
    walletService.deactivateWallet(WalletOwnerType.EMPLOYEE, employee._id),
  ]);

  logger.info({ employeeId }, 'Employee soft-deleted (isActive=false), financial history preserved');
}

export async function adjustBalance(
  employeeId: string,
  input: AdjustBalanceInput,
  performedByUserId: Types.ObjectId,
  actorRole?: UserRole
): Promise<{ employee: IEmployee; transaction: typeof LedgerTransaction.prototype }> {
  assertFeatureEnabled('ENABLE_ADJUST_BALANCE', actorRole);

  // Idempotency check — outside transaction (read-only, safe to retry)
  if (input.idempotencyKey) {
    const existingTransaction = await LedgerTransaction.findOne({
      idempotencyKey: input.idempotencyKey,
    });

    if (existingTransaction) {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new NotFoundError('Employee not found');
      }
      return { employee, transaction: existingTransaction };
    }
  }

  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!employee.isActive) {
    throw new BadRequestError('Cannot adjust balance for inactive employee');
  }

  const transactionType = input.amount > 0 ? TransactionType.DEPOSIT : TransactionType.CONSUME;

  const session = await mongoose.startSession();
  let resultTransaction: typeof LedgerTransaction.prototype;

  try {
    await session.withTransaction(async () => {
      let balanceBefore: number;
      let balanceAfter: number;

      if (input.amount > 0) {
        const result = await walletService.creditWallet(WalletOwnerType.EMPLOYEE, employee._id, input.amount, session);
        balanceBefore = result.balanceBefore;
        balanceAfter = result.balanceAfter;
      } else {
        const result = await walletService.debitWallet(WalletOwnerType.EMPLOYEE, employee._id, -input.amount, session);
        balanceBefore = result.balanceBefore;
        balanceAfter = result.balanceAfter;
      }

      const [tx] = await LedgerTransaction.create([{
        employeeId: employee._id,
        companyId: employee.companyId,
        type: transactionType,
        amount: input.amount,
        balanceBefore,
        balanceAfter,
        description: input.description,
        performedBy: performedByUserId,
        idempotencyKey: input.idempotencyKey,
      }], { session });

      await AuditLog.create([{
        actorUserId: performedByUserId,
        action: AuditAction.ADJUST_BALANCE,
        targetType: 'Employee',
        targetId: employee._id,
        metadata: { amount: input.amount, balanceBefore, balanceAfter, description: input.description },
      }], { session });

      resultTransaction = tx;
    });
  } finally {
    await session.endSession();
  }

  logger.info(
    {
      employeeId,
      amount: input.amount,
      performedBy: performedByUserId,
      transactionId: resultTransaction!._id,
    },
    'Balance adjusted'
  );

  return { employee, transaction: resultTransaction! };
}

export async function getEmployeeTransactions(
  employeeId: string,
  companyId?: string,
  page = 1,
  limit = 20
) {
  const query: Record<string, unknown> = { employeeId: new Types.ObjectId(employeeId) };

  if (companyId) {
    query.companyId = new Types.ObjectId(companyId);
  }

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    LedgerTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'name email'),
    LedgerTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// For COMPANY_VIEWER: only show deposits (DEPOSIT and CREDIT_RESET), never CONSUME
export async function getEmployeeDepositsOnly(
  employeeId: string,
  companyId: string,
  page = 1,
  limit = 20
) {
  const query = {
    employeeId: new Types.ObjectId(employeeId),
    companyId: new Types.ObjectId(companyId),
    type: { $in: [TransactionType.DEPOSIT, TransactionType.CREDIT_RESET] },
  };

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    LedgerTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'name email'),
    LedgerTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// Get employee by ID for COMPANY_VIEWER (without balance)
export async function getEmployeeByIdForViewer(
  employeeId: string,
  companyId: string
): Promise<CompanyEmployeeDTO> {
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId: new Types.ObjectId(companyId),
  });

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  return toCompanyEmployeeDTO(employee);
}

export async function getCompanyTransactions(
  companyId: string,
  page = 1,
  limit = 10
) {
  const query = { companyId: new Types.ObjectId(companyId) };

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    LedgerTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employeeId', 'name email')
      .populate('performedBy', 'name email'),
    LedgerTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function reloadSelectedBalances(
  companyId: string,
  employeeIds: string[],
  amount: number,
  performedByUserId: Types.ObjectId
): Promise<{ employeesUpdated: number; transactions: typeof LedgerTransaction.prototype[] }> {
  const employees = await Employee.find({
    _id: { $in: employeeIds.map(id => new Types.ObjectId(id)) },
    companyId: new Types.ObjectId(companyId),
    isActive: true,
  });

  const transactions: typeof LedgerTransaction.prototype[] = [];
  const batchId = employees.length > 1 ? new Types.ObjectId().toString() : undefined;

  for (const employee of employees) {
    const { balanceBefore, balanceAfter } = await walletService.creditWallet(
      WalletOwnerType.EMPLOYEE,
      employee._id,
      amount
    );

    const transaction = await LedgerTransaction.create({
      employeeId: employee._id,
      companyId: employee.companyId,
      type: TransactionType.DEPOSIT,
      amount,
      balanceBefore,
      balanceAfter,
      description: batchId
        ? `Recarga em lote - R$ ${amount.toFixed(2)} (${employees.length} funcionários)`
        : `Recarga de crédito R$ ${amount.toFixed(2)}`,
      performedBy: performedByUserId,
      batchId,
    });

    transactions.push(transaction);
  }

  logger.info(
    {
      companyId,
      amount,
      employeesUpdated: transactions.length,
      performedBy: performedByUserId,
      batchId,
    },
    'Selected employees balance reloaded'
  );

  return { employeesUpdated: transactions.length, transactions };
}

// Employee self-service functions (LGPD-compliant)
export async function getEmployeeSelf(employeeId: string): Promise<EmployeeSelfDTO> {
  const employee = await Employee.findById(employeeId).populate('companyId', 'name');

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!employee.isActive) {
    throw new BadRequestError('Employee account is inactive');
  }

  const companyName = typeof employee.companyId === 'object' ? (employee.companyId as any).name : undefined;
  const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);

  return toEmployeeSelfDTO(employee, companyName, balance);
}

export async function getEmployeeBalance(employeeId: string): Promise<{ balance: number }> {
  const employee = await Employee.findById(employeeId).select('isActive');

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!employee.isActive) {
    throw new BadRequestError('Employee account is inactive');
  }

  const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);
  return { balance };
}

export async function getEmployeeSelfTransactions(
  employeeId: string,
  page = 1,
  limit = 20
) {
  const employee = await Employee.findById(employeeId).select('isActive');

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!employee.isActive) {
    throw new BadRequestError('Employee account is inactive');
  }

  const query = { employeeId: new Types.ObjectId(employeeId) };
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    LedgerTransaction.find(query)
      .select('type amount balanceBefore balanceAfter description createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LedgerTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateEmployeeSelf(
  employeeId: string,
  input: { name?: string; phone?: string; address?: string; zipCode?: string }
): Promise<EmployeeSelfDTO> {
  const employee = await Employee.findById(employeeId).populate('companyId', 'name');

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!employee.isActive) {
    throw new BadRequestError('Employee account is inactive');
  }

  if (input.name !== undefined) employee.name = input.name;
  if (input.phone !== undefined) employee.phone = input.phone;
  if (input.address !== undefined) employee.address = input.address;
  if (input.zipCode !== undefined) employee.zipCode = input.zipCode;
  await employee.save();

  logger.info({ employeeId }, 'Employee updated own profile');

  const companyName = typeof employee.companyId === 'object' ? (employee.companyId as any).name : undefined;
  const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);
  return toEmployeeSelfDTO(employee, companyName, balance);
}

export async function updateEmployeeByAdmin(
  employeeId: string,
  input: {
    cardNumber?: string | null;
  }
): Promise<IEmployee> {
  const updateData: Record<string, unknown> = {};

  if (input.cardNumber !== undefined) updateData.cardNumber = input.cardNumber || null;

  if (input.cardNumber) {
    const existingEmployee = await Employee.findOne({
      cardNumber: input.cardNumber,
      _id: { $ne: new Types.ObjectId(employeeId) },
    });
    if (existingEmployee) {
      throw new ConflictError('Card number already in use by another employee');
    }

    const existingUser = await User.findOne({ cardNumber: input.cardNumber });
    if (existingUser) {
      throw new ConflictError('Card number already in use');
    }
  }

  const employee = await Employee.findByIdAndUpdate(employeeId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  logger.info({ employeeId, cardNumber: maskCardNumber(input.cardNumber ?? '') }, 'Employee card number updated by admin');

  return employee;
}

export async function updateEmployeeByViewer(
  employeeId: string,
  companyId: string,
  input: {
    name?: string;
    email?: string;
    phone?: string | null;
    address?: string | null;
    zipCode?: string | null;
    isActive?: boolean;
  }
): Promise<IEmployee> {
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId: new Types.ObjectId(companyId),
  });

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (input.name !== undefined) employee.name = input.name;
  if (input.phone !== undefined) employee.phone = input.phone || undefined;
  if (input.address !== undefined) employee.address = input.address || undefined;
  if (input.zipCode !== undefined) employee.zipCode = input.zipCode || undefined;
  if (input.isActive !== undefined) employee.isActive = input.isActive;

  if (input.email && input.email !== employee.email) {
    const existingEmployeeEmail = await Employee.findOne({
      email: input.email,
      _id: { $ne: new Types.ObjectId(employeeId) },
    });
    if (existingEmployeeEmail) {
      throw new ConflictError('Email already in use by another employee');
    }
    employee.email = input.email;
  }

  await employee.save();

  logger.info({ employeeId, companyId, fields: Object.keys(input) }, 'Employee updated by company viewer');

  return employee;
}
