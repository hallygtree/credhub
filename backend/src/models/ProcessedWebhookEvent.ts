import mongoose, { Schema, Document } from 'mongoose';
import { toJSONTransform } from './schemaOptions.js';

export interface IProcessedWebhookEvent extends Document {
  provider: string;
  eventId: string;
  paymentProviderId?: string;
  receivedAt: Date;
}

const processedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    provider: { type: String, required: true, default: 'mercadopago' },
    eventId: { type: String, required: true },
    paymentProviderId: { type: String },
    receivedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: toJSONTransform(),
  }
);

// Unique per provider + eventId
processedWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
processedWebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30-day TTL

export const ProcessedWebhookEvent = mongoose.model<IProcessedWebhookEvent>(
  'ProcessedWebhookEvent',
  processedWebhookEventSchema
);
