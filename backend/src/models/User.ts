import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { toJSONTransform } from './schemaOptions.js';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_VIEWER = 'COMPANY_VIEWER',
  EMPLOYEE = 'EMPLOYEE',
  CPF_USER = 'CPF_USER',
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  companyId?: Types.ObjectId;
  employeeId?: Types.ObjectId;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: Date;
  // CPF_USER fields
  cpf?: string;
  phone?: string;
  birthDate?: Date;
  balance?: number;
  address?: string;
  zipCode?: string;
  cardNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'Role is required'],
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: function (this: IUser) {
        return this.role === UserRole.COMPANY_VIEWER || this.role === UserRole.EMPLOYEE;
      },
      default: function (this: IUser) {
        return this.role === UserRole.CPF_USER ? null : undefined;
      },
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: function (this: IUser) {
        return this.role === UserRole.EMPLOYEE;
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    // CPF_USER specific fields
    cpf: {
      type: String,
      trim: true,
      match: [/^\d{11}$/, 'CPF deve ter 11 dígitos'],
    },
    phone: {
      type: String,
      trim: true,
    },
    birthDate: {
      type: Date,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    address: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    cardNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: toJSONTransform(['password']),
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ companyId: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ cpf: 1 }, { unique: true, sparse: true });

export const User = mongoose.model<IUser>('User', userSchema);
