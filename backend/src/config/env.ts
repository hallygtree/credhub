import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  LOGIN_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('5'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Maintenance mode
  MAINTENANCE_MODE: z.string().transform(v => v === 'true').default('false'),

  // Mercado Pago / Pix
  MERCADO_PAGO_ACCESS_TOKEN: z.string().min(1, 'MERCADO_PAGO_ACCESS_TOKEN is required'),
  PIX_KEY: z.string().optional(),
  PIX_PAYER_EMAIL: z.string().default('test@testuser.com'),
  PIX_MAX_AMOUNT: z.string().transform(Number).default('5000'),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
