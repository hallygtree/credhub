import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Payment, PaymentStatus } from '../models/Payment';
import { User, UserRole } from '../models/User';
import { Employee } from '../models/Employee';
import { Company } from '../models/Company';
import { LedgerTransaction } from '../models/LedgerTransaction';
import { Wallet, WalletOwnerType } from '../models/Wallet';
import { ProcessedWebhookEvent } from '../models/ProcessedWebhookEvent';
import * as paymentService from '../services/paymentService';
import { registerPurchaseByCard, reconcileFinancialIntegrity } from '../services/adminService';
import * as mercadoPagoService from '../services/mercadoPagoService';
import { AuditLog, AuditAction } from '../models/AuditLog';

// Mock mercadoPagoService
jest.mock('../services/mercadoPagoService');
// Mock env
jest.mock('../config/env', () => ({
  env: {
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token',
    PIX_KEY: 'test-pix-key',
    PIX_MAX_AMOUNT: 5000,
    MERCADO_PAGO_WEBHOOK_SECRET: 'test-secret',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
  },
}));
// Mock logger to silence output
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedMp = mercadoPagoService as jest.Mocked<typeof mercadoPagoService>;

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
  await Payment.deleteMany({});
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Company.deleteMany({});
  await LedgerTransaction.deleteMany({});
  await Wallet.deleteMany({});
  await ProcessedWebhookEvent.deleteMany({});
  await AuditLog.deleteMany({});
  jest.clearAllMocks();
});

// Helper to create a test CPF user
async function createTestCpfUser() {
  const user = await User.create({
    email: 'cpf@test.com',
    password: 'hashedpassword123',
    name: 'Test CPF User',
    role: UserRole.CPF_USER,
    balance: 0,
    cpf: '12345678901',
  });
  return user;
}

// Helper to create test company + employee + viewer
async function createTestCompanySetup() {
  const company = await Company.create({
    name: 'Test Company',
    cnpj: '12345678000100',
    email: 'company@test.com',
  });

  const employee1 = await Employee.create({
    name: 'Employee 1',
    email: 'emp1@test.com',
    cpf: '11111111111',
    companyId: company._id,
    balance: 0,
  });

  const employee2 = await Employee.create({
    name: 'Employee 2',
    email: 'emp2@test.com',
    cpf: '22222222222',
    companyId: company._id,
    balance: 100,
  });

  // Seed wallet for employee2 to reflect its pre-existing balance
  await Wallet.create({
    ownerType: WalletOwnerType.EMPLOYEE,
    ownerId: employee2._id,
    balance: 100,
    isActive: true,
  });

  const viewer = await User.create({
    email: 'viewer@test.com',
    password: 'hashedpassword123',
    name: 'Company Viewer',
    role: UserRole.COMPANY_VIEWER,
    companyId: company._id,
  });

  const employeeUser = await User.create({
    email: 'emp1@test.com',
    password: 'hashedpassword123',
    name: 'Employee 1',
    role: UserRole.EMPLOYEE,
    companyId: company._id,
    employeeId: employee1._id,
  });

  return { company, employee1, employee2, viewer, employeeUser };
}

function mockMpCreateSuccess(orderId = 'ORD-TEST-12345') {
  mockedMp.createPixPayment.mockResolvedValue({
    orderId,
    paymentId: 'PAY-TEST-001',
    status: 'action_required',
    qrCode: 'test-qr-code-data',
    qrCodeBase64: 'dGVzdC1xci1jb2Rl',
    ticketUrl: 'https://mp.com/ticket/123',
  });
}

describe('Payment Service', () => {
  describe('createPayment', () => {
    it('should create a Pix payment for CPF_USER', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess();

      const result = await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 50,
      });

      expect(result.paymentId).toBeDefined();
      expect(result.amount).toBe(50);
      expect(result.qrCode).toBe('test-qr-code-data');
      expect(result.qrCodeBase64).toBe('dGVzdC1xci1jb2Rl');
      expect(result.status).toBe('pending');

      const payment = await Payment.findById(result.paymentId);
      expect(payment).not.toBeNull();
      expect(payment!.status).toBe(PaymentStatus.PENDING);
      expect(payment!.providerPaymentId).toBe('ORD-TEST-12345');
    });

    it('should reject amount <= 0', async () => {
      const user = await createTestCpfUser();

      await expect(
        paymentService.createPayment({
          userId: user._id.toString(),
          role: UserRole.CPF_USER,
          amount: 0,
        })
      ).rejects.toThrow('Valor deve ser maior que zero');
    });

    it('should reject amount above PIX_MAX_AMOUNT', async () => {
      const user = await createTestCpfUser();

      await expect(
        paymentService.createPayment({
          userId: user._id.toString(),
          role: UserRole.CPF_USER,
          amount: 10000,
        })
      ).rejects.toThrow();
    });

    it('should create a company Pix payment with employee selection', async () => {
      const { viewer, employee1, employee2, company } = await createTestCompanySetup();
      mockMpCreateSuccess('ORD-TEST-99999');

      const result = await paymentService.createPayment({
        userId: viewer._id.toString(),
        role: UserRole.COMPANY_VIEWER,
        companyId: company._id.toString(),
        employeeIds: [employee1._id.toString(), employee2._id.toString()],
        amountPerEmployee: 100,
      });

      expect(result.amount).toBe(200); // 100 x 2 employees
      expect(result.paymentId).toBeDefined();

      const payment = await Payment.findById(result.paymentId);
      expect(payment!.employeeIds).toHaveLength(2);
      expect(payment!.amountPerEmployee).toBe(100);
    });

    it('should reject company payment without employees', async () => {
      const { viewer, company } = await createTestCompanySetup();

      await expect(
        paymentService.createPayment({
          userId: viewer._id.toString(),
          role: UserRole.COMPANY_VIEWER,
          companyId: company._id.toString(),
          employeeIds: [],
          amountPerEmployee: 100,
        })
      ).rejects.toThrow('Selecione pelo menos um colaborador');
    });
  });

  describe('processWebhook', () => {
    it('should credit CPF_USER Wallet on approved webhook (Wallet is SSOT)', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess();

      const payment = await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 75,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-TEST-12345',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      await paymentService.processWebhook('ORD-TEST-12345');

      // Wallet is SSOT — check wallet directly
      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id });
      expect(wallet).not.toBeNull();
      expect(wallet!.balance).toBe(75);

      // User.balance is NOT mirrored
      const rawUser = await User.findById(user._id);
      expect(rawUser!.balance).toBe(0);

      const updatedPayment = await Payment.findById(payment.paymentId);
      expect(updatedPayment!.status).toBe(PaymentStatus.APPROVED);
      expect(updatedPayment!.creditedAt).toBeDefined();

      const ledger = await LedgerTransaction.findOne({ cpfUserId: user._id });
      expect(ledger).not.toBeNull();
      expect(ledger!.amount).toBe(75);
      expect(ledger!.balanceAfter).toBe(75);
    });

    it('should credit employee Wallets for COMPANY_VIEWER payment', async () => {
      const { viewer, employee1, employee2, company } = await createTestCompanySetup();
      mockMpCreateSuccess('ORD-TEST-55555');

      const payment = await paymentService.createPayment({
        userId: viewer._id.toString(),
        role: UserRole.COMPANY_VIEWER,
        companyId: company._id.toString(),
        employeeIds: [employee1._id.toString(), employee2._id.toString()],
        amountPerEmployee: 50,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-TEST-55555',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      await paymentService.processWebhook('ORD-TEST-55555');

      // Balances from Wallet — Employee.balance NOT mirrored
      const wallet1 = await Wallet.findOne({ ownerType: WalletOwnerType.EMPLOYEE, ownerId: employee1._id });
      const wallet2 = await Wallet.findOne({ ownerType: WalletOwnerType.EMPLOYEE, ownerId: employee2._id });
      expect(wallet1!.balance).toBe(50);  // was 0 + 50
      expect(wallet2!.balance).toBe(150); // was 100 + 50

      const transactions = await LedgerTransaction.find({
        batchId: `pix-${payment.paymentId}`,
      });
      expect(transactions).toHaveLength(2);
    });

    it('should NOT duplicate credit on duplicate webhook (processingAt lock)', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess();

      await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 100,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-TEST-12345',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      // Process webhook twice sequentially
      await paymentService.processWebhook('ORD-TEST-12345');
      await paymentService.processWebhook('ORD-TEST-12345');

      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id });
      expect(wallet!.balance).toBe(100); // Should be 100, NOT 200

      const transactions = await LedgerTransaction.find({ cpfUserId: user._id });
      expect(transactions).toHaveLength(1); // Only one transaction
    });

    it('should NOT duplicate credit on concurrent webhooks (concurrency test)', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess('ORD-CONCURRENT');

      await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 100,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-CONCURRENT',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      // Fire two webhooks simultaneously
      await Promise.allSettled([
        paymentService.processWebhook('ORD-CONCURRENT'),
        paymentService.processWebhook('ORD-CONCURRENT'),
      ]);

      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id });
      expect(wallet!.balance).toBe(100); // Exactly one credit applied

      const transactions = await LedgerTransaction.find({ cpfUserId: user._id });
      expect(transactions).toHaveLength(1);
    }, 15000);

    it('should rollback Wallet credit if LedgerTransaction creation fails', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess('ORD-ROLLBACK');

      await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 50,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-ROLLBACK',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      // Force LedgerTransaction.create to throw inside the transaction
      const createSpy = jest.spyOn(LedgerTransaction, 'create').mockRejectedValueOnce(
        new Error('Simulated DB failure')
      );

      await expect(paymentService.processWebhook('ORD-ROLLBACK')).rejects.toThrow();

      // Transaction rolled back — Wallet should still be 0 (or not exist yet)
      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id });
      expect(wallet?.balance ?? 0).toBe(0);

      // No ledger entry should have been persisted
      const transactions = await LedgerTransaction.find({ cpfUserId: user._id });
      expect(transactions).toHaveLength(0);

      // processingAt lock should have been released
      const payment = await Payment.findOne({ providerPaymentId: 'ORD-ROLLBACK' });
      expect(payment!.processingAt).toBeUndefined();
      expect(payment!.status).toBe(PaymentStatus.PENDING);

      createSpy.mockRestore();
    }, 15000);

    it('should set processingAt as audit trail after successful credit', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess();

      await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 50,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-TEST-12345',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      await paymentService.processWebhook('ORD-TEST-12345');

      const updatedPayment = await Payment.findOne({ providerPaymentId: 'ORD-TEST-12345' });
      expect(updatedPayment!.processingAt).toBeDefined();
      expect(updatedPayment!.status).toBe(PaymentStatus.APPROVED);
    });

    it('should handle unknown payment gracefully', async () => {
      await paymentService.processWebhook('nonexistent-id');
      // Should not throw
    });
  });

  // ─── Chaos Tests ────────────────────────────────────────────────────────────

  describe('chaos: resilience under failures', () => {
    it('MP timeout on getOrderStatus → no credit applied, processingAt released', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess('ORD-TIMEOUT');

      await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 80,
      });

      // Simulate MP timeout by rejecting getOrderStatus
      mockedMp.getOrderStatus.mockRejectedValueOnce(new Error('ETIMEDOUT: connection timed out'));

      await expect(paymentService.processWebhook('ORD-TIMEOUT')).rejects.toThrow();

      // No wallet should have been created / credited
      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id });
      expect(wallet?.balance ?? 0).toBe(0);

      const transactions = await LedgerTransaction.find({ cpfUserId: user._id });
      expect(transactions).toHaveLength(0);

      // Payment still pending (not locked)
      const payment = await Payment.findOne({ providerPaymentId: 'ORD-TIMEOUT' });
      expect(payment!.status).toBe(PaymentStatus.PENDING);
    }, 15000);

    it('partial company payment failure mid-loop → all credits rolled back', async () => {
      const { viewer, employee1, employee2, company } = await createTestCompanySetup();
      mockMpCreateSuccess('ORD-PARTIAL');

      await paymentService.createPayment({
        userId: viewer._id.toString(),
        role: UserRole.COMPANY_VIEWER,
        companyId: company._id.toString(),
        employeeIds: [employee1._id.toString(), employee2._id.toString()],
        amountPerEmployee: 60,
      });

      mockedMp.getOrderStatus.mockResolvedValue({
        orderId: 'ORD-PARTIAL',
        orderStatus: 'processed',
        paymentStatus: 'approved',
        paymentStatusDetail: 'accredited',
      });

      // Fail on the 2nd LedgerTransaction.create call (i.e. between employees)
      let callCount = 0;
      const createSpy = jest.spyOn(LedgerTransaction, 'create').mockImplementation((...args) => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Simulated DB failure on 2nd employee')) as any;
        }
        return (LedgerTransaction.create as any).wrappedMethod?.(...args) ?? Promise.resolve([]);
      });

      await expect(paymentService.processWebhook('ORD-PARTIAL')).rejects.toThrow();

      // Both wallets must remain unchanged (transaction rolled back)
      const wallet1 = await Wallet.findOne({ ownerType: WalletOwnerType.EMPLOYEE, ownerId: employee1._id });
      const wallet2 = await Wallet.findOne({ ownerType: WalletOwnerType.EMPLOYEE, ownerId: employee2._id });
      expect(wallet1?.balance ?? 0).toBe(0);   // employee1 had 0
      expect(wallet2?.balance ?? 0).toBe(100); // employee2 had 100 (pre-existing wallet)

      // processingAt lock released so webhook can be retried
      const payment = await Payment.findOne({ providerPaymentId: 'ORD-PARTIAL' });
      expect(payment!.processingAt).toBeUndefined();
      expect(payment!.status).toBe(PaymentStatus.PENDING);

      createSpy.mockRestore();
    }, 20000);

    it('checkAndUpdatePaymentStatus handles MP polling failure gracefully', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess('ORD-POLL-FAIL');

      const result = await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 30,
      });

      // MP polling throws — should NOT throw to the caller
      mockedMp.getOrderStatus.mockRejectedValueOnce(new Error('Network error'));

      const statusResult = await paymentService.checkAndUpdatePaymentStatus(
        result.paymentId,
        user._id.toString()
      );

      // Payment stays pending, error is swallowed
      expect(statusResult.status).toBe(PaymentStatus.PENDING);
    }, 10000);
  });

  describe('getPaymentById (isolation)', () => {
    it('should NOT return payment belonging to another user', async () => {
      const user1 = await createTestCpfUser();
      const user2 = await User.create({
        email: 'other@test.com',
        password: 'hashedpassword123',
        name: 'Other User',
        role: UserRole.CPF_USER,
        cpf: '98765432100',
        balance: 0,
      });

      mockMpCreateSuccess();
      const payment = await paymentService.createPayment({
        userId: user1._id.toString(),
        role: UserRole.CPF_USER,
        amount: 50,
      });

      // User2 tries to access User1's payment
      await expect(
        paymentService.getPaymentById(payment.paymentId, user2._id.toString())
      ).rejects.toThrow('Pagamento não encontrado');
    });

    it('should return payment for correct user', async () => {
      const user = await createTestCpfUser();
      mockMpCreateSuccess();

      const payment = await paymentService.createPayment({
        userId: user._id.toString(),
        role: UserRole.CPF_USER,
        amount: 50,
      });

      const found = await paymentService.getPaymentById(
        payment.paymentId,
        user._id.toString()
      );
      expect(found).toBeDefined();
      expect(found._id.toString()).toBe(payment.paymentId);
    });
  });

  // ─── registerPurchaseByCard (AuditLog + rollback) ────────────────────────────

  describe('adminService - registerPurchaseByCard', () => {
    async function makeAdminUser() {
      return User.create({
        email: 'admin@test.com',
        password: 'hashedpw',
        name: 'Admin',
        role: UserRole.SUPER_ADMIN,
      });
    }

    it('should create an AuditLog entry when deducting from employee by card', async () => {
      const { employee1 } = await createTestCompanySetup();
      const admin = await makeAdminUser();

      // Give employee1 a funded wallet
      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee1._id,
        balance: 200,
        isActive: true,
      });
      await Employee.findByIdAndUpdate(employee1._id, { cardNumber: 'CARD-EMP-001' });

      await registerPurchaseByCard('CARD-EMP-001', 50, 'Almoço', admin._id, UserRole.SUPER_ADMIN);

      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.EMPLOYEE, ownerId: employee1._id });
      expect(wallet!.balance).toBe(150);

      const auditLog = await AuditLog.findOne({ actorUserId: admin._id });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.action).toBe(AuditAction.PURCHASE_BY_CARD);
      expect(auditLog!.targetType).toBe('Employee');
    });

    it('should rollback wallet debit if AuditLog creation fails (employee path)', async () => {
      const { employee1 } = await createTestCompanySetup();
      const admin = await makeAdminUser();

      await Wallet.create({
        ownerType: WalletOwnerType.EMPLOYEE,
        ownerId: employee1._id,
        balance: 200,
        isActive: true,
      });
      await Employee.findByIdAndUpdate(employee1._id, { cardNumber: 'CARD-FAIL-001' });

      const createSpy = jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(
        new Error('Simulated AuditLog failure')
      );

      await expect(
        registerPurchaseByCard('CARD-FAIL-001', 50, 'Almoço', admin._id, UserRole.SUPER_ADMIN)
      ).rejects.toThrow('Simulated AuditLog failure');

      // Wallet balance must be unchanged — transaction rolled back
      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.EMPLOYEE, ownerId: employee1._id });
      expect(wallet!.balance).toBe(200);

      const txCount = await LedgerTransaction.countDocuments({ employeeId: employee1._id });
      expect(txCount).toBe(0);

      createSpy.mockRestore();
    });
  });

  // ─── reconcileFinancialIntegrity (divergence detection) ──────────────────────

  describe('reconcileFinancialIntegrity', () => {
    it('should detect divergence when wallet balance does not match ledger sum', async () => {
      const user = await createTestCpfUser();

      // Create a wallet with balance 100
      await Wallet.create({
        ownerType: WalletOwnerType.CPF_USER,
        ownerId: user._id,
        balance: 100,
        isActive: true,
      });

      // Intentionally create NO LedgerTransactions — wallet says 100, ledger says 0
      const report = await reconcileFinancialIntegrity();

      expect(report.summary.isHealthy).toBe(false);
      expect(report.summary.divergenceCount).toBeGreaterThan(0);
      expect(report.balanceDivergences.length).toBeGreaterThan(0);

      const divergence = report.balanceDivergences.find(d => d.ownerId === user._id.toString());
      expect(divergence).toBeDefined();
      expect(divergence!.walletBalance).toBe(100);
      expect(divergence!.ledgerBalance).toBe(0);
      expect(divergence!.divergence).toBe(100);
      expect(divergence!.isConsistent).toBe(false);

      // No automatic correction — wallet balance must still be 100
      const wallet = await Wallet.findOne({ ownerType: WalletOwnerType.CPF_USER, ownerId: user._id });
      expect(wallet!.balance).toBe(100);
    });
  });
});
