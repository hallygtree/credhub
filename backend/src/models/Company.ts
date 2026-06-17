import mongoose, { Document, Schema, Types } from 'mongoose';
import { toJSONTransform } from './schemaOptions.js';

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    cnpj: {
      type: String,
      required: [true, 'CNPJ is required'],
      trim: true,
      match: [/^\d{14}$/, 'CNPJ must have 14 digits'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters'],
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

companySchema.index({ cnpj: 1 }, { unique: true });
companySchema.index({ email: 1 }, { unique: true });
companySchema.index({ isActive: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
