import { Types } from 'mongoose';
import { User, UserRole, Employee, LedgerTransaction } from '../models/index.js';
import { WalletOwnerType } from '../models/Wallet.js';
import { NotFoundError, BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as walletService from './walletService.js';

export interface UserProfileDTO {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  balance: number;
  companyName?: string;
  cardNumber?: string;
  isEmployee: boolean;
}

export async function getUserProfile(userId: string, role: UserRole, employeeId?: string): Promise<UserProfileDTO> {
  if (role === UserRole.EMPLOYEE && employeeId) {
    const employee = await Employee.findById(employeeId).populate('companyId', 'name');
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }
    if (!employee.isActive) {
      throw new BadRequestError('Account is inactive');
    }
    const companyName = typeof employee.companyId === 'object' ? (employee.companyId as any).name : undefined;
    const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);
    return {
      id: employee._id.toString(),
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      zipCode: employee.zipCode,
      balance,
      companyName,
      cardNumber: employee.cardNumber,
      isEmployee: true,
    };
  }

  // CPF_USER
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (!user.isActive) {
    throw new BadRequestError('Account is inactive');
  }
  const balance = await walletService.getWalletBalance(WalletOwnerType.CPF_USER, user._id);
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    zipCode: user.zipCode,
    balance,
    cardNumber: user.cardNumber,
    isEmployee: false,
  };
}

export async function getUserBalance(userId: string, role: UserRole, employeeId?: string): Promise<{ balance: number }> {
  if (role === UserRole.EMPLOYEE && employeeId) {
    const employee = await Employee.findById(employeeId).select('isActive');
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }
    if (!employee.isActive) {
      throw new BadRequestError('Account is inactive');
    }
    const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);
    return { balance };
  }

  // CPF_USER
  const user = await User.findById(userId).select('isActive');
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (!user.isActive) {
    throw new BadRequestError('Account is inactive');
  }
  const balance = await walletService.getWalletBalance(WalletOwnerType.CPF_USER, user._id);
  return { balance };
}

export async function getUserTransactions(
  userId: string,
  role: UserRole,
  employeeId?: string,
  page = 1,
  limit = 20
) {
  if (role === UserRole.EMPLOYEE && employeeId) {
    const employee = await Employee.findById(employeeId).select('isActive');
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }
    if (!employee.isActive) {
      throw new BadRequestError('Account is inactive');
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

  // CPF_USER
  const query = { cpfUserId: new Types.ObjectId(userId) };
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

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateUserProfile(
  userId: string,
  role: UserRole,
  employeeId: string | undefined,
  input: UpdateProfileInput
): Promise<UserProfileDTO> {
  if (role === UserRole.EMPLOYEE && employeeId) {
    const employee = await Employee.findById(employeeId).populate('companyId', 'name');
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }
    if (!employee.isActive) {
      throw new BadRequestError('Account is inactive');
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (input.email && input.email !== user.email) {
      const existingUser = await User.findOne({ email: input.email, _id: { $ne: userId } });
      if (existingUser) {
        throw new ConflictError('Email ja esta em uso');
      }
      user.email = input.email;
      employee.email = input.email;
    }

    if (input.currentPassword && input.newPassword) {
      const isPasswordValid = await user.comparePassword(input.currentPassword);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Senha atual incorreta');
      }
      user.password = input.newPassword;
      user.mustChangePassword = false;
    }

    if (input.name !== undefined) employee.name = input.name;
    if (input.phone !== undefined) employee.phone = input.phone;
    if (input.address !== undefined) employee.address = input.address;
    if (input.zipCode !== undefined) employee.zipCode = input.zipCode;

    await Promise.all([employee.save(), user.save()]);

    logger.info({ employeeId, emailChanged: !!input.email, passwordChanged: !!input.newPassword }, 'Employee updated own profile');

    const companyName = typeof employee.companyId === 'object' ? (employee.companyId as any).name : undefined;
    const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);
    return {
      id: employee._id.toString(),
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      zipCode: employee.zipCode,
      balance,
      companyName,
      cardNumber: employee.cardNumber,
      isEmployee: true,
    };
  }

  // CPF_USER
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (!user.isActive) {
    throw new BadRequestError('Account is inactive');
  }

  if (input.email && input.email !== user.email) {
    const existingUser = await User.findOne({ email: input.email, _id: { $ne: userId } });
    if (existingUser) {
      throw new ConflictError('Email ja esta em uso');
    }
    user.email = input.email;
  }

  if (input.currentPassword && input.newPassword) {
    const isPasswordValid = await user.comparePassword(input.currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Senha atual incorreta');
    }
    user.password = input.newPassword;
    user.mustChangePassword = false;
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.address !== undefined) user.address = input.address;
  if (input.zipCode !== undefined) user.zipCode = input.zipCode;
  await user.save();

  logger.info({ userId, emailChanged: !!input.email, passwordChanged: !!input.newPassword }, 'CPF user updated own profile');

  const cpfBalance = await walletService.getWalletBalance(WalletOwnerType.CPF_USER, user._id);
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    zipCode: user.zipCode,
    balance: cpfBalance,
    cardNumber: user.cardNumber,
    isEmployee: false,
  };
}
