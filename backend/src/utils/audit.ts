import { Types } from 'mongoose';
import { AuditLog, AuditAction } from '../models/AuditLog.js';
import { logger } from './logger.js';

interface AuditParams {
  actorUserId: Types.ObjectId;
  action: AuditAction;
  targetType: string;
  targetId?: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Fire-and-forget audit log. Never throws — errors are logged and swallowed
 * so they never block the main request flow.
 */
export async function audit(params: AuditParams): Promise<void> {
  AuditLog.create(params).catch((err) => {
    logger.error({ err, action: params.action }, 'Failed to write audit log');
  });
}
