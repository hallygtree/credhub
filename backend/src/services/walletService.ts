import mongoose, { Types } from 'mongoose';
import { Wallet, IWallet, WalletOwnerType } from '../models/Wallet.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { Money } from '../utils/money.js';

type ClientSession = mongoose.ClientSession;

/**
 * Get or create a wallet for an owner (upsert, safe for concurrent calls).
 */
export async function getOrCreateWallet(
  ownerType: WalletOwnerType,
  ownerId: Types.ObjectId,
  session?: ClientSession
): Promise<IWallet> {
  const opts = session ? { upsert: true, new: true, session } : { upsert: true, new: true };
  const wallet = await Wallet.findOneAndUpdate(
    { ownerType, ownerId },
    { $setOnInsert: { ownerType, ownerId, balance: 0, isActive: true } },
    opts
  );
  return wallet!;
}

/**
 * Credit an amount to a wallet. Auto-creates the wallet if it doesn't exist.
 * Wallet is the single source of truth — no longer mirrors to Employee/User.balance.
 */
export async function creditWallet(
  ownerType: WalletOwnerType,
  ownerId: Types.ObjectId,
  amount: number,
  session?: ClientSession
): Promise<{ balanceBefore: number; balanceAfter: number; wallet: IWallet }> {
  if (amount <= 0) throw new BadRequestError('Credit amount must be positive');

  // Ensure wallet exists (upsert)
  await Wallet.findOneAndUpdate(
    { ownerType, ownerId },
    { $setOnInsert: { ownerType, ownerId, balance: 0, isActive: true } },
    { upsert: true, ...(session ? { session } : {}) }
  );

  const wallet = await Wallet.findOneAndUpdate(
    { ownerType, ownerId, isActive: true },
    { $inc: { balance: amount } },
    { new: true, ...(session ? { session } : {}) }
  );

  if (!wallet) {
    throw new BadRequestError('Carteira inativa — não é possível creditar');
  }

  // Use Money arithmetic to avoid float precision errors
  const balanceAfterM = Money.fromReais(wallet.balance);
  const creditM = Money.fromReais(amount);
  const balanceBeforeM = balanceAfterM.subtract(creditM);

  const balanceBefore = balanceBeforeM.toReais();
  const balanceAfter = balanceAfterM.toReais();

  logger.debug({ ownerType, ownerId: ownerId.toString(), amount, balanceBefore, balanceAfter }, 'Wallet credited');
  return { balanceBefore, balanceAfter, wallet };
}

/**
 * Debit an amount from a wallet.
 * Atomically prevents negative balance via MongoDB query filter.
 * Wallet is the single source of truth — no longer mirrors to Employee/User.balance.
 */
export async function debitWallet(
  ownerType: WalletOwnerType,
  ownerId: Types.ObjectId,
  amount: number,
  session?: ClientSession
): Promise<{ balanceBefore: number; balanceAfter: number; wallet: IWallet }> {
  if (amount <= 0) throw new BadRequestError('Debit amount must be positive');

  const wallet = await Wallet.findOneAndUpdate(
    { ownerType, ownerId, isActive: true, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true, ...(session ? { session } : {}) }
  );

  if (!wallet) {
    const existing = await Wallet.findOne(
      { ownerType, ownerId },
      null,
      session ? { session } : {}
    ).select('isActive balance');
    if (!existing) throw new NotFoundError('Carteira não encontrada');
    if (!existing.isActive) throw new BadRequestError('Carteira inativa');
    throw new BadRequestError('Saldo insuficiente');
  }

  // Use Money arithmetic to avoid float precision errors
  const balanceAfterM = Money.fromReais(wallet.balance);
  const debitM = Money.fromReais(amount);
  const balanceBeforeM = balanceAfterM.add(debitM);

  const balanceBefore = balanceBeforeM.toReais();
  const balanceAfter = balanceAfterM.toReais();

  logger.debug({ ownerType, ownerId: ownerId.toString(), amount, balanceBefore, balanceAfter }, 'Wallet debited');
  return { balanceBefore, balanceAfter, wallet };
}

/**
 * Deactivate a wallet (used on employee soft-delete).
 */
export async function deactivateWallet(
  ownerType: WalletOwnerType,
  ownerId: Types.ObjectId
): Promise<void> {
  await Wallet.findOneAndUpdate({ ownerType, ownerId }, { isActive: false });
}

/**
 * Get current wallet balance (returns 0 if wallet doesn't exist).
 */
export async function getWalletBalance(
  ownerType: WalletOwnerType,
  ownerId: Types.ObjectId
): Promise<number> {
  const wallet = await Wallet.findOne({ ownerType, ownerId }).select('balance');
  return wallet?.balance ?? 0;
}
