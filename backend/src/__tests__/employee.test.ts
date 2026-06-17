import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Employee } from '../models/Employee';
import { Company } from '../models/Company';
import { User, UserRole } from '../models/User';
import { LedgerTransaction } from '../models/LedgerTransaction';
import { Wallet, WalletOwnerType } from '../models/Wallet';
import { AuditLog, AuditAction } from '../models/AuditLog';
import * as employeeService from '../services/employeeService';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
}, 30000);

afterEach(async () => {
  await Employee.deleteMany({});
  await Company.deleteMany({});
  await User.deleteMany({});
  await LedgerTransaction.deleteMany({});
  await Wallet.deleteMany({});
  await AuditLog.deleteMany({});
  jest.clearAllMocks();
});

async function makeCompanyAndViewer() {
  const company = await Company.create({
    name: 'Acme',
    cnpj: '12345678000100',
    email: 'acme@test.com',
  });
  const viewer = await User.create({
    email: 'viewer@test.com',
    password: 'hashedpw',
    name: 'Viewer',
    role: UserRole.COMPANY_VIEWER,
    companyId: company._id,
  });
  return { company, viewer };
}

const baseInput = {
  name: 'João Silva',
  email: 'joao@test.com',
  cpf: '11122233344',
  phone: '11999990000',
  password: 'TempPass123!',
};

describe('employeeService', () => {
  describe('createEmployee', () => {
    it('should create employee, linked user, and wallet', async () => {
      const { company } = await makeCompanyAndViewer();

      const employee = await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });

      expect(employee.name).toBe('João Silva');
      expect(employee.balance).toBe(0);

      const user = await User.findOne({ email: 'joao@test.com' });
      expect(user).not.toBeNull();
      expect(user!.role).toBe(UserRole.EMPLOYEE);
      expect(user!.employeeId!.toString()).toBe(employee._id.toString());

      const wallet = await Wallet.findOne({
        ownerId: employee._id,
        ownerType: WalletOwnerType.EMPLOYEE,
      });
      expect(wallet).not.toBeNull();
      expect(wallet!.balance).toBe(0);
      expect(wallet!.isActive).toBe(true);
    });

    it('should reject duplicate email', async () => {
      const { company } = await makeCompanyAndViewer();
      await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });

      await expect(
        employeeService.createEmployee({
          ...baseInput,
          cpf: '99988877766',
          companyId: company._id.toString(),
        })
      ).rejects.toThrow('Employee with this email or CPF already exists');
    });

    it('should reject duplicate CPF', async () => {
      const { company } = await makeCompanyAndViewer();
      await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });

      await expect(
        employeeService.createEmployee({
          ...baseInput,
          email: 'other@test.com',
          companyId: company._id.toString(),
        })
      ).rejects.toThrow('Employee with this email or CPF already exists');
    });

    it('should reject if company does not exist', async () => {
      await expect(
        employeeService.createEmployee({
          ...baseInput,
          companyId: new mongoose.Types.ObjectId().toString(),
        })
      ).rejects.toThrow('Company not found or inactive');
    });

    it('should reject if company is inactive', async () => {
      const company = await Company.create({
        name: 'Inactive Co',
        cnpj: '99999999000100',
        email: 'inactive@test.com',
        isActive: false,
      });

      await expect(
        employeeService.createEmployee({
          ...baseInput,
          companyId: company._id.toString(),
        })
      ).rejects.toThrow('Company not found or inactive');
    });
  });

  describe('deleteEmployee (soft delete)', () => {
    it('should deactivate employee, linked user, and wallet — preserving data', async () => {
      const { company } = await makeCompanyAndViewer();
      const employee = await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });

      await employeeService.deleteEmployee(employee._id.toString(), company._id.toString());

      const deletedEmployee = await Employee.findById(employee._id);
      expect(deletedEmployee!.isActive).toBe(false);

      const deletedUser = await User.findOne({ email: 'joao@test.com' });
      expect(deletedUser!.isActive).toBe(false);

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.isActive).toBe(false);

      // Document should still exist (not hard-deleted)
      expect(deletedEmployee).not.toBeNull();
    });

    it('should throw NotFoundError when employee does not exist', async () => {
      await expect(
        employeeService.deleteEmployee(new mongoose.Types.ObjectId().toString())
      ).rejects.toThrow('Employee not found');
    });

    it('should throw BadRequestError when employee is already inactive', async () => {
      const { company } = await makeCompanyAndViewer();
      const employee = await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });

      await employeeService.deleteEmployee(employee._id.toString(), company._id.toString());

      await expect(
        employeeService.deleteEmployee(employee._id.toString(), company._id.toString())
      ).rejects.toThrow('Employee is already inactive');
    });
  });

  describe('adjustBalance', () => {
    let employee: Awaited<ReturnType<typeof employeeService.createEmployee>>;
    let viewerUserId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const { company, viewer } = await makeCompanyAndViewer();
      viewerUserId = viewer._id;
      employee = await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });
      // Seed wallet with 200 so debit tests have balance to work with
      await Wallet.findOneAndUpdate(
        { ownerId: employee._id, ownerType: WalletOwnerType.EMPLOYEE },
        { balance: 200 }
      );
      await Employee.findByIdAndUpdate(employee._id, { balance: 200 });
    });

    it('should credit employee balance and create a LedgerTransaction', async () => {
      await employeeService.adjustBalance(
        employee._id.toString(),
        { amount: 50, description: 'Bônus' },
        viewerUserId
      );

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.balance).toBe(250);

      const tx = await LedgerTransaction.findOne({ employeeId: employee._id });
      expect(tx).not.toBeNull();
      expect(tx!.amount).toBe(50);
      expect(tx!.balanceBefore).toBe(200);
      expect(tx!.balanceAfter).toBe(250);
    });

    it('should debit employee balance', async () => {
      await employeeService.adjustBalance(
        employee._id.toString(),
        { amount: -80, description: 'Ajuste manual' },
        viewerUserId
      );

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.balance).toBe(120);
    });

    it('should throw when debit amount exceeds balance', async () => {
      await expect(
        employeeService.adjustBalance(
          employee._id.toString(),
          { amount: -500, description: 'Overdebit' },
          viewerUserId
        )
      ).rejects.toThrow('Saldo insuficiente');
    });

    it('should throw for inactive employee', async () => {
      await Employee.findByIdAndUpdate(employee._id, { isActive: false });

      await expect(
        employeeService.adjustBalance(
          employee._id.toString(),
          { amount: 50, description: 'Recharge' },
          viewerUserId
        )
      ).rejects.toThrow('Cannot adjust balance for inactive employee');
    });

    it('should be idempotent when an idempotencyKey is provided', async () => {
      const key = 'unique-key-abc123';

      await employeeService.adjustBalance(
        employee._id.toString(),
        { amount: 50, description: 'First', idempotencyKey: key },
        viewerUserId
      );

      // Second call with same key should not change balance
      await employeeService.adjustBalance(
        employee._id.toString(),
        { amount: 50, description: 'Second', idempotencyKey: key },
        viewerUserId
      );

      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.balance).toBe(250); // Only one credit applied

      const txCount = await LedgerTransaction.countDocuments({ employeeId: employee._id });
      expect(txCount).toBe(1);
    });

    it('should create an AuditLog entry on successful balance adjustment', async () => {
      await employeeService.adjustBalance(
        employee._id.toString(),
        { amount: 50, description: 'Bônus de teste' },
        viewerUserId
      );

      const auditLog = await AuditLog.findOne({ actorUserId: viewerUserId });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.action).toBe(AuditAction.ADJUST_BALANCE);
      expect(auditLog!.targetType).toBe('Employee');
      expect(auditLog!.targetId!.toString()).toBe(employee._id.toString());
      expect((auditLog!.metadata as any).amount).toBe(50);
    });

    it('should rollback wallet change if AuditLog creation fails', async () => {
      const createSpy = jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(
        new Error('Simulated AuditLog DB failure')
      );

      await expect(
        employeeService.adjustBalance(
          employee._id.toString(),
          { amount: 50, description: 'Tentativa com falha' },
          viewerUserId
        )
      ).rejects.toThrow('Simulated AuditLog DB failure');

      // Wallet must be unchanged — transaction rolled back
      const wallet = await Wallet.findOne({ ownerId: employee._id });
      expect(wallet!.balance).toBe(200);

      // No LedgerTransaction should have been persisted
      const txCount = await LedgerTransaction.countDocuments({ employeeId: employee._id });
      expect(txCount).toBe(0);

      createSpy.mockRestore();
    });
  });

  describe('reloadSelectedBalances', () => {
    it('should credit all specified employees', async () => {
      const { company, viewer } = await makeCompanyAndViewer();

      const emp1 = await employeeService.createEmployee({
        ...baseInput,
        companyId: company._id.toString(),
      });
      const emp2 = await employeeService.createEmployee({
        ...baseInput,
        email: 'maria@test.com',
        cpf: '55566677788',
        companyId: company._id.toString(),
      });

      await employeeService.reloadSelectedBalances(
        company._id.toString(),
        [emp1._id.toString(), emp2._id.toString()],
        100,
        viewer._id
      );

      const wallet1 = await Wallet.findOne({ ownerId: emp1._id });
      const wallet2 = await Wallet.findOne({ ownerId: emp2._id });
      expect(wallet1!.balance).toBe(100);
      expect(wallet2!.balance).toBe(100);
    });
  });
});
