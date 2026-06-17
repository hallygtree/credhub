import { User, IUser, UserRole } from '../models/index.js';
import { WalletOwnerType } from '../models/Wallet.js';
import { UnauthorizedError, ConflictError, BadRequestError } from '../utils/errors.js';
import { generateToken } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';
import { maskEmail, maskCpf } from '../utils/mask.js';
import crypto from 'crypto';
import * as walletService from './walletService.js';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string;
    employeeId?: string;
    mustChangePassword: boolean;
  };
  token: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const user = await User.findOne({ email, isActive: true }).select('+password');

  if (!user) {
    logger.warn({ email: maskEmail(email) }, 'Login attempt with non-existent email');
    throw new UnauthorizedError('Invalid credentials');
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    logger.warn({ email: maskEmail(email) }, 'Login attempt with invalid password');
    throw new UnauthorizedError('Invalid credentials');
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user);

  logger.info({ userId: user._id, email: maskEmail(user.email) }, 'User logged in successfully');

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId?.toString(),
      employeeId: user.employeeId?.toString(),
      mustChangePassword: user.mustChangePassword,
    },
    token,
  };
}

export async function getCurrentUser(userId: string): Promise<IUser> {
  const user = await User.findById(userId).populate('companyId', 'name');

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  return user;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<AuthResponse> {
  const user = await User.findById(userId).select('+password');

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Check if new password is the same as current password
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw new BadRequestError('New password must be different from current password');
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  const token = generateToken(user);

  logger.info({ userId: user._id }, 'User changed password successfully');

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId?.toString(),
      employeeId: user.employeeId?.toString(),
      mustChangePassword: user.mustChangePassword,
    },
    token,
  };
}

export async function updateEmail(
  userId: string,
  newEmail: string,
  password: string
): Promise<{ email: string }> {
  const user = await User.findById(userId).select('+password');

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Check if user can change email (only EMPLOYEE and CPF_USER without company)
  if (user.role !== UserRole.EMPLOYEE && user.role !== UserRole.CPF_USER) {
    throw new BadRequestError('Only employees and CPF users can change their email');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Password is incorrect');
  }

  // Check if email is already in use
  const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
  if (existingUser && existingUser._id.toString() !== userId) {
    throw new ConflictError('Email already in use');
  }

  user.email = newEmail;
  await user.save();

  logger.info({ userId: user._id, newEmail: maskEmail(newEmail) }, 'User updated email successfully');

  return { email: user.email };
}

export interface CpfUserRegisterData {
  name: string;
  phone: string;
  cpf: string;
  birthDate: string;
  email: string;
  password: string;
}

export async function registerCpfUser(data: CpfUserRegisterData): Promise<AuthResponse> {
  // Check if email already exists
  const existingEmail = await User.findOne({ email: data.email.toLowerCase() });
  if (existingEmail) {
    throw new ConflictError('Email already in use');
  }

  // Check if CPF already exists
  const existingCpf = await User.findOne({ cpf: data.cpf });
  if (existingCpf) {
    throw new ConflictError('CPF already registered');
  }

  const user = await User.create({
    email: data.email,
    password: data.password,
    name: data.name,
    role: UserRole.CPF_USER,
    cpf: data.cpf,
    phone: data.phone,
    birthDate: new Date(data.birthDate),
    mustChangePassword: false, // User chose their own password
    companyId: null,
  });

  // Create wallet for the new CPF user
  await walletService.getOrCreateWallet(WalletOwnerType.CPF_USER, user._id);

  const token = generateToken(user);

  logger.info({ userId: user._id, email: maskEmail(user.email), cpf: maskCpf(user.cpf) }, 'CPF user registered successfully');

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    token,
  };
}

/**
 * Generate a random password for new users created by admin
 */
export function generateRandomPassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@#$%&*';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  // Ensure at least one of each required type
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}
