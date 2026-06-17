import mongoose, { Document, Schema, Types } from 'mongoose';
import { toJSONTransform } from './schemaOptions.js';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  CONSUME = 'CONSUME',
  CREDIT_RESET = 'CREDIT_RESET',
}

export interface ILedgerTransaction extends Document {
  _id: Types.ObjectId;
  employeeId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  cpfUserId?: Types.ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy: Types.ObjectId;
  idempotencyKey?: string;
  batchId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ledgerTransactionSchema = new Schema<ILedgerTransaction>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    cpfUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before is required'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by user is required'],
    },
    idempotencyKey: {
      type: String,
    },
    batchId: {
      type: String,
      sparse: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: toJSONTransform(),
  }
);

ledgerTransactionSchema.index({ employeeId: 1, createdAt: -1 });
ledgerTransactionSchema.index({ companyId: 1, createdAt: -1 });
ledgerTransactionSchema.index({ cpfUserId: 1, createdAt: -1 });
ledgerTransactionSchema.index({ performedBy: 1 });
ledgerTransactionSchema.index({ type: 1, createdAt: -1 });
ledgerTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const LedgerTransaction = mongoose.model<ILedgerTransaction>(
  'LedgerTransaction',
  ledgerTransactionSchema
);
