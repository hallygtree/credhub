import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, UserRole } from '../models/User';
import { Wallet, WalletOwnerType } from '../models/Wallet';
import * as authService from '../services/authService';

jest.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-unit-tests-min-32-chars!!',
    JWT_EXPIRES_IN: '1h',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Wallet.deleteMany({});
  jest.clearAllMocks();
});

const baseRegisterData = {
  name: 'Test User',
  phone: '11999999999',
  cpf: '12345678901',
  birthDate: '1990-01-01',
  email: 'test@example.com',
  password: 'Password123!',
};

describe('authService', () => {
  describe('registerCpfUser', () => {
    it('should register a new CPF user and return a token', async () => {
      const result = await authService.registerCpfUser(baseRegisterData);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe(UserRole.CPF_USER);
      expect(result.user.mustChangePassword).toBe(false);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });

    it('should create a wallet with zero balance on registration', async () => {
      await authService.registerCpfUser(baseRegisterData);

      const user = await User.findOne({ email: 'test@example.com' });
      const wallet = await Wallet.findOne({
        ownerType: WalletOwnerType.CPF_USER,
        ownerId: user!._id,
      });

      expect(wallet).not.toBeNull();
      expect(wallet!.balance).toBe(0);
      expect(wallet!.isActive).toBe(true);
    });

    it('should reject duplicate email', async () => {
      await authService.registerCpfUser(baseRegisterData);

      await expect(
        authService.registerCpfUser({ ...baseRegisterData, cpf: '98765432100' })
      ).rejects.toThrow('Email already in use');
    });

    it('should reject duplicate CPF', async () => {
      await authService.registerCpfUser(baseRegisterData);

      await expect(
        authService.registerCpfUser({ ...baseRegisterData, email: 'other@example.com' })
      ).rejects.toThrow('CPF already registered');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.registerCpfUser(baseRegisterData);
    });

    it('should login successfully with valid credentials', async () => {
      const result = await authService.login('test@example.com', 'Password123!');

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe(UserRole.CPF_USER);
      expect(result.token).toBeDefined();
    });

    it('should update lastLogin on successful login', async () => {
      await authService.login('test@example.com', 'Password123!');

      const user = await User.findOne({ email: 'test@example.com' });
      expect(user!.lastLogin).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      await expect(
        authService.login('nobody@example.com', 'Password123!')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject inactive user', async () => {
      await User.updateOne({ email: 'test@example.com' }, { isActive: false });

      await expect(
        authService.login('test@example.com', 'Password123!')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('changePassword', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authService.registerCpfUser(baseRegisterData);
      userId = result.user.id;
    });

    it('should change password and return a new token', async () => {
      const result = await authService.changePassword(userId, 'Password123!', 'NewPassword456@');

      expect(result.token).toBeDefined();
      expect(result.user.mustChangePassword).toBe(false);
    });

    it('should allow login with the new password after change', async () => {
      await authService.changePassword(userId, 'Password123!', 'NewPassword456@');

      await expect(
        authService.login('test@example.com', 'NewPassword456@')
      ).resolves.toBeDefined();
    });

    it('should reject wrong current password', async () => {
      await expect(
        authService.changePassword(userId, 'WrongCurrent!', 'NewPassword456@')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should reject when new password equals current password', async () => {
      await expect(
        authService.changePassword(userId, 'Password123!', 'Password123!')
      ).rejects.toThrow('New password must be different from current password');
    });

    it('should set mustChangePassword to false after change', async () => {
      // First manually set mustChangePassword to true
      await User.updateOne({ _id: userId }, { mustChangePassword: true });

      await authService.changePassword(userId, 'Password123!', 'NewPassword456@');

      const user = await User.findById(userId);
      expect(user!.mustChangePassword).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return the user by ID', async () => {
      const registered = await authService.registerCpfUser(baseRegisterData);

      const user = await authService.getCurrentUser(registered.user.id);

      expect(user.email).toBe('test@example.com');
    });

    it('should throw when user is inactive', async () => {
      const registered = await authService.registerCpfUser(baseRegisterData);
      await User.updateOne({ _id: registered.user.id }, { isActive: false });

      await expect(
        authService.getCurrentUser(registered.user.id)
      ).rejects.toThrow('User not found or inactive');
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate a 12-character password', () => {
      const password = authService.generateRandomPassword();
      expect(password.length).toBe(12);
    });

    it('should generate unique passwords on each call', () => {
      const passwords = new Set(
        Array.from({ length: 10 }, () => authService.generateRandomPassword())
      );
      expect(passwords.size).toBeGreaterThan(1);
    });

    it('should contain at least one uppercase letter', () => {
      const password = authService.generateRandomPassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it('should contain at least one digit', () => {
      const password = authService.generateRandomPassword();
      expect(/\d/.test(password)).toBe(true);
    });
  });
});
