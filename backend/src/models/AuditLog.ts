import mongoose, { Schema, Document, Types } from 'mongoose';
import { toJSONTransform } from './schemaOptions.js';

export enum AuditAction {
  // Balance operations
  ADJUST_BALANCE = 'ADJUST_BALANCE',
  PURCHASE_BY_CARD = 'PURCHASE_BY_CARD',
  PIX_CREDIT = 'PIX_CREDIT',
  // Company management
  CREATE_COMPANY = 'CREATE_COMPANY',
  UPDATE_COMPANY = 'UPDATE_COMPANY',
  UPDATE_COMPANY_VIEWER = 'UPDATE_COMPANY_VIEWER',
  // User management
  ASSIGN_CARD = 'ASSIGN_CARD',
  EMPLOYEE_SOFT_DELETE = 'EMPLOYEE_SOFT_DELETE',
}

export interface IAuditLog extends Document {
  actorUserId: Types.ObjectId;
  action: AuditAction;
  targetType: string;
  targetId?: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: Object.values(AuditAction), required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: toJSONTransform(),
  }
);

auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
