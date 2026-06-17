import mongoose, { Schema, Document, Types } from 'mongoose';
import { toJSONTransform } from './schemaOptions.js';

export enum WalletOwnerType {
  EMPLOYEE = 'EMPLOYEE',
  CPF_USER = 'CPF_USER',
}

export interface IWallet extends Document {
  ownerType: WalletOwnerType;
  ownerId: Types.ObjectId;
  balance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    ownerType: {
      type: String,
      enum: Object.values(WalletOwnerType),
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: toJSONTransform(),
  }
);

// Unique wallet per owner
walletSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });
walletSchema.index({ isActive: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
