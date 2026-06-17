import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from './User.js';
import { toJSONTransform } from './schemaOptions.js';

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface IPayment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: UserRole;
  amount: number;
  amountPerEmployee?: number;
  employeeIds?: Types.ObjectId[];
  provider: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  qrCode?: string;
  qrCodeBase64?: string;
  copiaECola?: string;
  ticketUrl?: string;
  expirationTime?: Date;
  creditedAt?: Date;
  processingAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'Role is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    amountPerEmployee: {
      type: Number,
      min: [0.01, 'Amount per employee must be greater than zero'],
    },
    employeeIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    }],
    provider: {
      type: String,
      default: 'mercadopago',
    },
    providerPaymentId: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: true,
    },
    qrCode: String,
    qrCodeBase64: String,
    copiaECola: String,
    ticketUrl: String,
    expirationTime: Date,
    creditedAt: Date,
    processingAt: Date,
  },
  {
    timestamps: true,
    toJSON: toJSONTransform(),
  }
);

paymentSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
