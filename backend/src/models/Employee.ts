import mongoose, { Document, Schema, Types } from 'mongoose';
import { toJSONTransform } from './schemaOptions.js';

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  cpf: string;
  cardNumber?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  companyId: Types.ObjectId;
  balance: number;
  monthlyAllowance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    cpf: {
      type: String,
      required: [true, 'CPF is required'],
      trim: true,
      match: [/^\d{11}$/, 'CPF must have 11 digits'],
    },
    cardNumber: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    monthlyAllowance: {
      type: Number,
      default: 0,
      min: [0, 'Monthly allowance cannot be negative'],
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

employeeSchema.index({ companyId: 1, isActive: 1 });
employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ cpf: 1 }, { unique: true });
employeeSchema.index({ cardNumber: 1 }, { unique: true, sparse: true });

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
