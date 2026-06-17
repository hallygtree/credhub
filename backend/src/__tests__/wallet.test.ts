import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Wallet, WalletOwnerType } from '../models/Wallet';
import { Employee } from '../models/Employee';
import { User, UserRole } from '../models/User';
import { Company } from '../models/Company';
import * as walletService from '../services/walletService';

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
  await Wallet.deleteMany({});
  await Employee.deleteMany({});
  await User.deleteMany({});
  await Company.deleteMany({});
  jest.clearAllMocks();
});

async function makeEmployee() {
  const company = await Company.create({
    name: 'Test Co',
    cnpj: '12345678000100',
    email: 'co@test.com',
  });
  const employee = await Employee.create({
    name: 'Emp',
    email: 'emp@test.com',
    cpf: '11111111111',
    companyId: company._id,
    balance: 0,
  });
  return { employee, company };
}

async function makeCpfUser() {
  return User.create({
    email: 'cpf@test.com',
    password: 'hashedpw',
    name: 'CPF User',
    role: UserRole.CPF_USER,
    cpf: '99999999999',
    balance: 0,
  });
}

describe('walletService', () => {
  describe('getOrCreateWallet', () => {
    it('should create a new wallet when none exists', async () => {
      const { employee } = await makeEmployee();

      const wallet = await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);

      expect(wallet.balance).toBe(0);
      expect(wallet.isActive).toBe(true);
      expect(wallet.ownerType).toBe(WalletOwnerType.EMPLOYEE);
      expect(wallet.ownerId.toString()).toBe(employee._id.toString());
    });

    it('should be idempotent — returns the same wallet on repeated calls', async () => {
      const { employee } = await makeEmployee();

      const w1 = await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);
      const w2 = await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);

      expect(w1._id.toString()).toBe(w2._id.toString());
      expect(await Wallet.countDocuments({ ownerId: employee._id })).toBe(1);
    });
  });

  describe('creditWallet', () => {
    it('should credit an EMPLOYEE wallet — Wallet is sole source of truth', async () => {
      const { employee } = await makeEmployee();
      await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);

      const { balanceBefore, balanceAfter } = await walletService.creditWallet(
        WalletOwnerType.EMPLOYEE,
        employee._id,
        100
      );

      expect(balanceBefore).toBe(0);
      expect(balanceAfter).toBe(100);

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.balance).toBe(100);

      // Employee.balance is NOT mirrored — Wallet is SSOT
      const rawEmployee = await Employee.findById(employee._id);
      expect(rawEmployee!.balance).toBe(0);
    });

    it('should credit a CPF_USER wallet — Wallet is sole source of truth', async () => {
      const user = await makeCpfUser();
      await walletService.getOrCreateWallet(WalletOwnerType.CPF_USER, user._id);

      const { balanceBefore, balanceAfter } = await walletService.creditWallet(
        WalletOwnerType.CPF_USER,
        user._id,
        50
      );

      expect(balanceBefore).toBe(0);
      expect(balanceAfter).toBe(50);

      const wallet = await Wallet.findOne({ ownerId: user._id });
      expect(wallet!.balance).toBe(50);

      // User.balance is NOT mirrored — Wallet is SSOT
      const rawUser = await User.findById(user._id);
      expect(rawUser!.balance).toBe(0);
    });

    it('should accumulate balance across multiple credits', async () => {
      const { employee } = await makeEmployee();
      await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);

      await walletService.creditWallet(WalletOwnerType.EMPLOYEE, employee._id, 100);
      await walletService.creditWallet(WalletOwnerType.EMPLOYEE, employee._id, 50);
      const { balanceAfter } = await walletService.creditWallet(
        WalletOwnerType.EMPLOYEE,
        employee._id,
        25
      );

      expect(balanceAfter).toBe(175);
    });

    it('should reject amount <= 0', async () => {
      const { employee } = await makeEmployee();
      await walletService.getOrCreateWallet(WalletOwnerType.EMPLOYEE, employee._id);

      await expect(
        walletService.creditWallet(WalletOwnerType.EMPLOYEE, employee._id, 0)
      ).rejects.toThrow('Credit amount must be positive');

      await expect(
        walletService.creditWallet(WalletOwnerType.EMPLOYEE, employee._id, -10)
      ).rejects.toThrow('Credit amount must be positive');
    });

    it('should throw when trying to credit an inactive wallet', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 0,
        isActive: false,
      });

      await expect(
        walletService.creditWallet(WalletOwnerType.EMPLOYEE, employee._id, 50)
      ).rejects.toThrow('Carteira inativa');
    });
  });

  describe('debitWallet', () => {
    it('should debit an EMPLOYEE wallet — Wallet is sole source of truth', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 200,
        isActive: true,
      });

      const { balanceBefore, balanceAfter } = await walletService.debitWallet(
        WalletOwnerType.EMPLOYEE,
        employee._id,
        80
      );

      expect(balanceBefore).toBe(200);
      expect(balanceAfter).toBe(120);

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.balance).toBe(120);

      // Employee.balance is NOT mirrored — Wallet is SSOT
      const rawEmployee = await Employee.findById(employee._id);
      expect(rawEmployee!.balance).toBe(0);
    });

    it('should reject debit when balance is insufficient (prevents negative balance)', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 50,
        isActive: true,
      });

      await expect(
        walletService.debitWallet(WalletOwnerType.EMPLOYEE, employee._id, 100)
      ).rejects.toThrow('Saldo insuficiente');
    });

    it('should reject debit on inactive wallet', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 500,
        isActive: false,
      });

      await expect(
        walletService.debitWallet(WalletOwnerType.EMPLOYEE, employee._id, 50)
      ).rejects.toThrow('Carteira inativa');
    });

    it('should reject amount <= 0', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 100,
        isActive: true,
      });

      await expect(
        walletService.debitWallet(WalletOwnerType.EMPLOYEE, employee._id, 0)
      ).rejects.toThrow('Debit amount must be positive');
    });

    it('should throw NotFoundError when wallet does not exist', async () => {
      const { employee } = await makeEmployee();

      await expect(
        walletService.debitWallet(WalletOwnerType.EMPLOYEE, employee._id, 50)
      ).rejects.toThrow('Carteira não encontrada');
    });
  });

  describe('deactivateWallet', () => {
    it('should set isActive to false', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 0,
        isActive: true,
      });

      await walletService.deactivateWallet(WalletOwnerType.EMPLOYEE, employee._id);

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.isActive).toBe(false);
    });
  });

  describe('getWalletBalance', () => {
    it('should return the current wallet balance', async () => {
      const { employee } = await makeEmployee();
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee._id,
        balance: 350,
        isActive: true,
      });

      const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);

      expect(balance).toBe(350);
    });

    it('should return 0 when no wallet exists', async () => {
      const { employee } = await makeEmployee();

      const balance = await walletService.getWalletBalance(WalletOwnerType.EMPLOYEE, employee._id);

      expect(balance).toBe(0);
    });
  });
});
