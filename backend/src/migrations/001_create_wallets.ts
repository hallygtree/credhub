/**
 * Migration 001 — Create Wallets
 *
 * Creates a Wallet document for every existing Employee and CPF_USER,
 * seeding the balance from the denormalized Employee.balance / User.balance
 * fields so no balance data is lost.
 *
 * Safe to run multiple times (upsert with $setOnInsert).
 *
 * Usage:
 *   npx tsx src/migrations/001_create_wallets.ts
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Employee, User, UserRole } from '../models/index.js';
import { Wallet, WalletOwnerType } from '../models/Wallet.js';
import { logger } from '../utils/logger.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB for migration 001_create_wallets');

  // --- Employees ---
  const employees = await Employee.find({}).select('_id balance isActive');
  let empCreated = 0;
  let empSkipped = 0;

  for (const emp of employees) {
    const result = await Wallet.findOneAndUpdate(
      { ownerType: WalletOwnerType.EMPLOYEE, ownerId: emp._id },
      {
        $setOnInsert: {
          ownerType: WalletOwnerType.EMPLOYEE,
          ownerId: emp._id,
          balance: emp.balance ?? 0,
          isActive: emp.isActive,
        },
      },
      { upsert: true, new: false }
    );

    if (result === null) {
      empCreated++;
    } else {
      empSkipped++;
    }
  }

  logger.info(`Employees: ${empCreated} wallets created, ${empSkipped} already existed`);

  // --- CPF Users ---
  const cpfUsers = await User.find({ role: UserRole.CPF_USER }).select('_id balance isActive');
  let cpfCreated = 0;
  let cpfSkipped = 0;

  for (const user of cpfUsers) {
    const result = await Wallet.findOneAndUpdate(
      { ownerType: WalletOwnerType.CPF_USER, ownerId: user._id },
      {
        $setOnInsert: {
          ownerType: WalletOwnerType.CPF_USER,
          ownerId: user._id,
          balance: user.balance ?? 0,
          isActive: user.isActive,
        },
      },
      { upsert: true, new: false }
    );

    if (result === null) {
      cpfCreated++;
    } else {
      cpfSkipped++;
    }
  }

  logger.info(`CPF Users: ${cpfCreated} wallets created, ${cpfSkipped} already existed`);

  await mongoose.disconnect();
  logger.info('Migration 001_create_wallets completed successfully');
}

run().catch((err) => {
  logger.error({ err }, 'Migration 001_create_wallets failed');
  process.exit(1);
});
