import mongoose, { Types } from 'mongoose';
import { env } from './config/env.js';
import {
  User, UserRole,
  Company,
  Employee,
  LedgerTransaction, TransactionType,
  Payment, PaymentStatus,
  Wallet, WalletOwnerType,
} from './models/index.js';
import { logger } from './utils/logger.js';

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

async function ensureInitialData() {
  // ── Super admin ───────────────────────────────────────────────────────────
  let admin = await User.findOne({ role: UserRole.SUPER_ADMIN });
  if (!admin) {
    admin = await User.create({
      email: 'admin@credhub.com',
      password: 'Admin@123456',
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      mustChangePassword: false,
    });
    logger.info('Super admin created');
  }

  // ── Company 1 ─────────────────────────────────────────────────────────────
  let company1 = await Company.findOne({ cnpj: '12345678901234' });
  if (!company1) {
    company1 = await Company.create({
      name: 'Empresa Demo LTDA',
      cnpj: '12345678901234',
      email: 'contato@empresademo.com',
      phone: '11999999999',
      address: 'Rua Demo, 123 - São Paulo, SP',
    });
  }

  let viewer1 = await User.findOne({ email: 'empresa@demo.com' });
  if (!viewer1) {
    viewer1 = await User.create({
      email: 'empresa@demo.com',
      password: 'Empresa@123456',
      name: 'Gestor Empresa Demo',
      role: UserRole.COMPANY_VIEWER,
      companyId: company1._id,
      mustChangePassword: false,
    });
  }

  const empDefs1 = [
    { name: 'João Silva',    email: 'joao.silva@empresademo.com',  cpf: '11122233344', card: 'CARD001', loginEmail: 'joao@demo.com',  loginPass: 'Joao@123456'  },
    { name: 'Maria Santos',  email: 'maria.santos@empresademo.com', cpf: '22233344455', card: 'CARD002', loginEmail: 'maria@demo.com', loginPass: 'Maria@123456' },
    { name: 'Pedro Oliveira',email: 'pedro.oliveira@empresademo.com',cpf: '33344455566', card: 'CARD003', loginEmail: 'pedro@demo.com', loginPass: 'Pedro@123456' },
  ];

  for (const def of empDefs1) {
    let emp = await Employee.findOne({ cpf: def.cpf });
    if (!emp) {
      emp = await Employee.create({
        name: def.name,
        email: def.email,
        cpf: def.cpf,
        companyId: company1._id,
        cardNumber: def.card,
      });
    }
    await Wallet.findOneAndUpdate(
      { ownerType: WalletOwnerType.EMPLOYEE, ownerId: emp._id },
      { $setOnInsert: { ownerType: WalletOwnerType.EMPLOYEE, ownerId: emp._id, balance: 0, isActive: true } },
      { upsert: true }
    );
    if (!(await User.findOne({ email: def.loginEmail }))) {
      await User.create({
        email: def.loginEmail,
        password: def.loginPass,
        name: def.name,
        role: UserRole.EMPLOYEE,
        companyId: company1._id,
        employeeId: emp._id,
        mustChangePassword: false,
      });
    }
  }

  // ── Company 2 ─────────────────────────────────────────────────────────────
  let company2 = await Company.findOne({ cnpj: '98765432100001' });
  if (!company2) {
    company2 = await Company.create({
      name: 'Tech Solutions Informática',
      cnpj: '98765432100001',
      email: 'contato@techsolutions.com',
      phone: '11988880000',
      address: 'Av. Tecnologia, 456 - São Paulo, SP',
    });
  }

  let viewer2 = await User.findOne({ email: 'techviewer@demo.com' });
  if (!viewer2) {
    viewer2 = await User.create({
      email: 'techviewer@demo.com',
      password: 'TechViewer@123456',
      name: 'Gestor Tech Solutions',
      role: UserRole.COMPANY_VIEWER,
      companyId: company2._id,
      mustChangePassword: false,
    });
  }

  const empDefs2 = [
    { name: 'Ana Costa',    email: 'ana.costa@techsolutions.com',   cpf: '44455566677', card: 'CARD004', loginEmail: 'ana@demo.com',    loginPass: 'Ana@123456'    },
    { name: 'Carlos Mendes',email: 'carlos.mendes@techsolutions.com',cpf: '55566677788', card: 'CARD005', loginEmail: 'carlos@demo.com', loginPass: 'Carlos@123456' },
  ];

  for (const def of empDefs2) {
    let emp = await Employee.findOne({ cpf: def.cpf });
    if (!emp) {
      emp = await Employee.create({
        name: def.name,
        email: def.email,
        cpf: def.cpf,
        companyId: company2._id,
        cardNumber: def.card,
      });
    }
    await Wallet.findOneAndUpdate(
      { ownerType: WalletOwnerType.EMPLOYEE, ownerId: emp._id },
      { $setOnInsert: { ownerType: WalletOwnerType.EMPLOYEE, ownerId: emp._id, balance: 0, isActive: true } },
      { upsert: true }
    );
    if (!(await User.findOne({ email: def.loginEmail }))) {
      await User.create({
        email: def.loginEmail,
        password: def.loginPass,
        name: def.name,
        role: UserRole.EMPLOYEE,
        companyId: company2._id,
        employeeId: emp._id,
        mustChangePassword: false,
      });
    }
  }

  // ── CPF user ──────────────────────────────────────────────────────────────
  let cpfUser = await User.findOne({ email: 'cpf.demo@teste.com' });
  if (!cpfUser) {
    cpfUser = await User.create({
      email: 'cpf.demo@teste.com',
      password: 'CpfDemo@123456',
      name: 'Beatriz Fernandes',
      role: UserRole.CPF_USER,
      cpf: '12345678909',
      phone: '11988887777',
      birthDate: new Date('1992-08-22'),
      cardNumber: 'CARD006',
      mustChangePassword: false,
    });
    await Wallet.create({
      ownerType: WalletOwnerType.CPF_USER,
      ownerId: cpfUser._id,
      balance: 0,
      isActive: true,
    });
  }

}

async function ensureMockTransactions() {
  const txCount = await LedgerTransaction.countDocuments();
  if (txCount > 0) {
    logger.info(`Skipping mock transactions (${txCount} already exist)`);
    return;
  }

  const admin    = (await User.findOne({ role: UserRole.SUPER_ADMIN }))!;
  const company1 = (await Company.findOne({ cnpj: '12345678901234' }))!;
  const company2 = (await Company.findOne({ cnpj: '98765432100001' }))!;
  const viewer1  = (await User.findOne({ email: 'empresa@demo.com' }))!;
  const viewer2  = (await User.findOne({ email: 'techviewer@demo.com' }))!;
  const e1 = (await Employee.findOne({ cpf: '11122233344' }))!; // João
  const e2 = (await Employee.findOne({ cpf: '22233344455' }))!; // Maria
  const e3 = (await Employee.findOne({ cpf: '33344455566' }))!; // Pedro
  const e4 = (await Employee.findOne({ cpf: '44455566677' }))!; // Ana
  const e5 = (await Employee.findOne({ cpf: '55566677788' }))!; // Carlos
  const beatriz = (await User.findOne({ email: 'cpf.demo@teste.com' }))!;

  // Track running balances keyed by _id string
  const bal: Record<string, number> = {
    [e1._id.toString()]: 0,
    [e2._id.toString()]: 0,
    [e3._id.toString()]: 0,
    [e4._id.toString()]: 0,
    [e5._id.toString()]: 0,
    [beatriz._id.toString()]: 0,
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  type AnyEmployee = typeof e1;

  async function batchPix(opts: {
    viewerId: Types.ObjectId;
    companyId: Types.ObjectId;
    employees: AnyEmployee[];
    amtPerEmp: number;
    date: Date;
    orderId: string;
  }) {
    const { viewerId, companyId, employees, amtPerEmp, date, orderId } = opts;
    const payment = await Payment.create({
      userId: viewerId,
      role: UserRole.COMPANY_VIEWER,
      amount: amtPerEmp * employees.length,
      amountPerEmployee: amtPerEmp,
      employeeIds: employees.map(e => e._id),
      provider: 'mercadopago',
      providerPaymentId: orderId,
      status: PaymentStatus.APPROVED,
      creditedAt: date,
      createdAt: date,
      updatedAt: date,
    });
    await Payment.collection.updateOne({ _id: payment._id }, { $set: { createdAt: date, updatedAt: date } });

    for (const emp of employees) {
      const key = emp._id.toString();
      const balanceBefore = bal[key];
      const balanceAfter  = balanceBefore + amtPerEmp;
      const tx = await LedgerTransaction.create({
        employeeId: emp._id,
        companyId,
        type: TransactionType.DEPOSIT,
        amount: amtPerEmp,
        balanceBefore,
        balanceAfter,
        description: `Crédito PIX - ${orderId}`,
        performedBy: viewerId,
        idempotencyKey: `pix-credit-${orderId}-${emp._id}`,
        batchId: `pix-${orderId}`,
        metadata: { paymentId: payment._id.toString() },
        createdAt: date,
      });
      await LedgerTransaction.collection.updateOne({ _id: tx._id }, { $set: { createdAt: date } });
      bal[key] = balanceAfter;
    }
  }

  async function cardConsume(opts: {
    emp: AnyEmployee;
    companyId: Types.ObjectId;
    amount: number;
    desc: string;
    date: Date;
  }) {
    const { emp, companyId, amount, desc, date } = opts;
    const key = emp._id.toString();
    const balanceBefore = bal[key];
    const balanceAfter  = balanceBefore - amount;
    const tx = await LedgerTransaction.create({
      employeeId: emp._id,
      companyId,
      type: TransactionType.CONSUME,
      amount: -amount,
      balanceBefore,
      balanceAfter,
      description: desc,
      performedBy: admin._id,
      createdAt: date,
    });
    await LedgerTransaction.collection.updateOne({ _id: tx._id }, { $set: { createdAt: date } });
    bal[key] = balanceAfter;
  }

  async function cpfPix(opts: { amount: number; date: Date; orderId: string }) {
    const { amount, date, orderId } = opts;
    const key = beatriz._id.toString();
    const balanceBefore = bal[key];
    const balanceAfter  = balanceBefore + amount;
    const payment = await Payment.create({
      userId: beatriz._id,
      role: UserRole.CPF_USER,
      amount,
      provider: 'mercadopago',
      providerPaymentId: orderId,
      status: PaymentStatus.APPROVED,
      creditedAt: date,
      createdAt: date,
      updatedAt: date,
    });
    await Payment.collection.updateOne({ _id: payment._id }, { $set: { createdAt: date, updatedAt: date } });
    const tx = await LedgerTransaction.create({
      cpfUserId: beatriz._id,
      type: TransactionType.DEPOSIT,
      amount,
      balanceBefore,
      balanceAfter,
      description: `Crédito PIX - ${orderId}`,
      performedBy: beatriz._id,
      idempotencyKey: `pix-credit-${orderId}-${beatriz._id}`,
      metadata: { orderId },
      createdAt: date,
    });
    await LedgerTransaction.collection.updateOne({ _id: tx._id }, { $set: { createdAt: date } });
    bal[key] = balanceAfter;
  }

  async function cpfConsume(opts: { amount: number; desc: string; date: Date }) {
    const { amount, desc, date } = opts;
    const key = beatriz._id.toString();
    const balanceBefore = bal[key];
    const balanceAfter  = balanceBefore - amount;
    const tx = await LedgerTransaction.create({
      cpfUserId: beatriz._id,
      type: TransactionType.CONSUME,
      amount: -amount,
      balanceBefore,
      balanceAfter,
      description: desc,
      performedBy: admin._id,
      createdAt: date,
    });
    await LedgerTransaction.collection.updateOne({ _id: tx._id }, { $set: { createdAt: date } });
    bal[key] = balanceAfter;
  }

  // ── Novembro 2025 ─────────────────────────────────────────────────────────
  await batchPix({ viewerId: viewer1._id, companyId: company1._id, employees: [e1, e2, e3], amtPerEmp: 400, date: d('2025-11-05'), orderId: 'ORD-C1-NOV2025' });
  await batchPix({ viewerId: viewer2._id, companyId: company2._id, employees: [e4, e5],     amtPerEmp: 350, date: d('2025-11-06'), orderId: 'ORD-C2-NOV2025' });
  await cpfPix({ amount: 200, date: d('2025-11-08'), orderId: 'ORD-CPF-NOV2025' });

  await cardConsume({ emp: e1, companyId: company1._id, amount: 35.50, desc: 'Almoço - João Silva',     date: d('2025-11-10') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 65.00, desc: 'Almoço - Maria Santos',   date: d('2025-11-11') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 50.00, desc: 'Almoço - Pedro Oliveira', date: d('2025-11-12') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 45.00, desc: 'Almoço - Ana Costa',      date: d('2025-11-12') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 38.00, desc: 'Almoço - Carlos Mendes',  date: d('2025-11-13') });
  await cpfConsume({ amount: 45.00, desc: 'Refeição - Beatriz Fernandes', date: d('2025-11-15') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 42.00, desc: 'Almoço - João Silva',     date: d('2025-11-17') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 25.50, desc: 'Almoço - Pedro Oliveira', date: d('2025-11-18') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 32.00, desc: 'Jantar - Ana Costa',      date: d('2025-11-19') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 55.00, desc: 'Almoço - Carlos Mendes',  date: d('2025-11-20') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 28.90, desc: 'Jantar - João Silva',     date: d('2025-11-24') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 30.00, desc: 'Almoço - Maria Santos',   date: d('2025-11-25') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 44.00, desc: 'Almoço - Pedro Oliveira', date: d('2025-11-26') });

  // ── Dezembro 2025 ─────────────────────────────────────────────────────────
  await batchPix({ viewerId: viewer1._id, companyId: company1._id, employees: [e1, e2, e3], amtPerEmp: 400, date: d('2025-12-03'), orderId: 'ORD-C1-DEC2025' });
  await batchPix({ viewerId: viewer2._id, companyId: company2._id, employees: [e4, e5],     amtPerEmp: 350, date: d('2025-12-04'), orderId: 'ORD-C2-DEC2025' });
  await cpfPix({ amount: 300, date: d('2025-12-10'), orderId: 'ORD-CPF-DEC2025' });

  await cardConsume({ emp: e1, companyId: company1._id, amount: 45.00, desc: 'Almoço - João Silva',     date: d('2025-12-08') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 42.50, desc: 'Almoço - Maria Santos',   date: d('2025-12-09') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 38.00, desc: 'Almoço - Pedro Oliveira', date: d('2025-12-10') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 55.00, desc: 'Almoço - Ana Costa',      date: d('2025-12-09') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 42.00, desc: 'Almoço - Carlos Mendes',  date: d('2025-12-10') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 38.50, desc: 'Almoço - João Silva',     date: d('2025-12-15') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 55.00, desc: 'Almoço - Maria Santos',   date: d('2025-12-16') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 62.50, desc: 'Almoço - Pedro Oliveira', date: d('2025-12-17') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 28.50, desc: 'Jantar - Ana Costa',      date: d('2025-12-16') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 30.50, desc: 'Almoço - Carlos Mendes',  date: d('2025-12-17') });
  await cpfConsume({ amount: 80.00, desc: 'Refeição - Beatriz Fernandes', date: d('2025-12-20') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 52.00, desc: 'Jantar - João Silva',     date: d('2025-12-22') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 28.00, desc: 'Almoço - Maria Santos',   date: d('2025-12-23') });

  // ── Janeiro 2026 ──────────────────────────────────────────────────────────
  await batchPix({ viewerId: viewer1._id, companyId: company1._id, employees: [e1, e2, e3], amtPerEmp: 400, date: d('2026-01-07'), orderId: 'ORD-C1-JAN2026' });
  await batchPix({ viewerId: viewer2._id, companyId: company2._id, employees: [e4, e5],     amtPerEmp: 350, date: d('2026-01-08'), orderId: 'ORD-C2-JAN2026' });
  await cpfPix({ amount: 150, date: d('2026-01-10'), orderId: 'ORD-CPF-JAN2026' });

  await cardConsume({ emp: e1, companyId: company1._id, amount: 29.80, desc: 'Almoço - João Silva',     date: d('2026-01-12') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 80.00, desc: 'Almoço - Maria Santos',   date: d('2026-01-13') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 35.00, desc: 'Almoço - Pedro Oliveira', date: d('2026-01-14') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 48.00, desc: 'Almoço - Ana Costa',      date: d('2026-01-13') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 60.00, desc: 'Almoço - Carlos Mendes',  date: d('2026-01-14') });
  await cpfConsume({ amount: 60.00, desc: 'Refeição - Beatriz Fernandes', date: d('2026-01-15') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 55.00, desc: 'Almoço - João Silva',     date: d('2026-01-19') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 45.00, desc: 'Almoço - Maria Santos',   date: d('2026-01-20') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 48.00, desc: 'Almoço - Pedro Oliveira', date: d('2026-01-21') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 65.00, desc: 'Almoço - Ana Costa',      date: d('2026-01-20') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 45.00, desc: 'Almoço - Carlos Mendes',  date: d('2026-01-21') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 40.20, desc: 'Jantar - João Silva',     date: d('2026-01-26') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 55.00, desc: 'Almoço - Pedro Oliveira', date: d('2026-01-27') });

  // ── Fevereiro 2026 ────────────────────────────────────────────────────────
  await batchPix({ viewerId: viewer1._id, companyId: company1._id, employees: [e1, e2, e3], amtPerEmp: 400, date: d('2026-02-04'), orderId: 'ORD-C1-FEB2026' });
  await batchPix({ viewerId: viewer2._id, companyId: company2._id, employees: [e4, e5],     amtPerEmp: 350, date: d('2026-02-05'), orderId: 'ORD-C2-FEB2026' });

  await cardConsume({ emp: e1, companyId: company1._id, amount: 48.00, desc: 'Almoço - João Silva',     date: d('2026-02-09') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 35.00, desc: 'Almoço - Maria Santos',   date: d('2026-02-10') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 40.00, desc: 'Almoço - Pedro Oliveira', date: d('2026-02-11') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 30.00, desc: 'Almoço - Ana Costa',      date: d('2026-02-10') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 35.00, desc: 'Almoço - Carlos Mendes',  date: d('2026-02-11') });
  await cardConsume({ emp: e1, companyId: company1._id, amount: 33.50, desc: 'Almoço - João Silva',     date: d('2026-02-17') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 60.00, desc: 'Almoço - Maria Santos',   date: d('2026-02-18') });
  await cardConsume({ emp: e3, companyId: company1._id, amount: 30.00, desc: 'Almoço - Pedro Oliveira', date: d('2026-02-19') });
  await cardConsume({ emp: e4, companyId: company2._id, amount: 52.00, desc: 'Almoço - Ana Costa',      date: d('2026-02-17') });
  await cardConsume({ emp: e5, companyId: company2._id, amount: 48.00, desc: 'Almoço - Carlos Mendes',  date: d('2026-02-18') });
  await cardConsume({ emp: e2, companyId: company1._id, amount: 25.50, desc: 'Jantar - Maria Santos',   date: d('2026-02-24') });

  // ── Pagamentos pendentes (simulam PIX aguardando confirmação) ─────────────
  await Payment.create({
    userId: viewer1._id,
    role: UserRole.COMPANY_VIEWER,
    amount: 1200,
    amountPerEmployee: 400,
    employeeIds: [e1._id, e2._id, e3._id],
    provider: 'mercadopago',
    providerPaymentId: 'ORD-C1-PENDING-MAR2026',
    status: PaymentStatus.PENDING,
    qrCode: 'mock-qr-empresa-demo-mar2026',
    copiaECola: '00020126360014br.gov.bcb.pix0114mock-key-demo520400005303986540412.005802BR5913Empresa Demo6009Sao Paulo6304ABCD',
    expirationTime: d('2026-03-10'),
    createdAt: d('2026-03-04'),
    updatedAt: d('2026-03-04'),
  });

  await Payment.create({
    userId: beatriz._id,
    role: UserRole.CPF_USER,
    amount: 250,
    provider: 'mercadopago',
    providerPaymentId: 'ORD-CPF-PENDING-FEB2026',
    status: PaymentStatus.PENDING,
    qrCode: 'mock-qr-beatriz-feb2026',
    copiaECola: '00020126360014br.gov.bcb.pix0114mock-key-beatriz520400005303986540325.005802BR5917Beatriz Fernandes6009Sao Paulo6304DCBA',
    expirationTime: d('2026-02-28'),
    createdAt: d('2026-02-20'),
    updatedAt: d('2026-02-20'),
  });

  // ── Sincroniza saldos das wallets com o ledger calculado ──────────────────
  const empIds = [e1._id, e2._id, e3._id, e4._id, e5._id];
  for (const empId of empIds) {
    const balance = bal[empId.toString()] ?? 0;
    await Wallet.findOneAndUpdate(
      { ownerType: WalletOwnerType.EMPLOYEE, ownerId: empId },
      { $set: { balance } }
    );
  }
  await Wallet.findOneAndUpdate(
    { ownerType: WalletOwnerType.CPF_USER, ownerId: beatriz._id },
    { $set: { balance: bal[beatriz._id.toString()] ?? 0 } }
  );

  const txTotal = await LedgerTransaction.countDocuments();
  logger.info(`Mock transactions seeded: ${txTotal} ledger entries`);
}

async function seed() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    await ensureInitialData();
    await ensureMockTransactions();

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║         SEED CONCLUÍDO COM SUCESSO       ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('  SUPER ADMIN:');
    console.log('    admin@credhub.com  /  Admin@123456\n');
    console.log('  EMPRESA DEMO LTDA (4 meses de histórico):');
    console.log('    empresa@demo.com  /  Empresa@123456  (viewer)');
    console.log('    joao@demo.com     /  Joao@123456     (CARD001)');
    console.log('    maria@demo.com    /  Maria@123456    (CARD002)');
    console.log('    pedro@demo.com    /  Pedro@123456    (CARD003)\n');
    console.log('  TECH SOLUTIONS INFORMÁTICA (4 meses de histórico):');
    console.log('    techviewer@demo.com  /  TechViewer@123456  (viewer)');
    console.log('    ana@demo.com         /  Ana@123456         (CARD004)');
    console.log('    carlos@demo.com      /  Carlos@123456      (CARD005)\n');
    console.log('  CPF USER:');
    console.log('    cpf.demo@teste.com  /  CpfDemo@123456  (CARD006)');
    console.log('    CPF: 123.456.789-09\n');
    console.log('  PAGAMENTOS PENDENTES (para simular chegada de PIX):');
    console.log('    ORD-C1-PENDING-MAR2026  — R$ 1.200,00  (Empresa Demo, 3 funcionários)');
    console.log('    ORD-CPF-PENDING-FEB2026 — R$   250,00  (Beatriz Fernandes)\n');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  Transações: Nov/25 → Fev/26  (4 meses) ║');
    console.log('╚══════════════════════════════════════════╝\n');

    await mongoose.disconnect();
    logger.info('Seed completed');
  } catch (error) {
    logger.error({ err: error }, 'Seed failed');
    process.exit(1);
  }
}

seed();
