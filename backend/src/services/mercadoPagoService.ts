import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const MERCADO_PAGO_API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15_000;

const mpClient = axios.create({
  baseURL: MERCADO_PAGO_API,
  timeout: TIMEOUT_MS,
  headers: {
    'Authorization': `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Log Mercado Pago errors in detail for debugging
mpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(
        {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url,
        },
        'Mercado Pago API error'
      );
    }
    throw error;
  }
);

// ─── Orders API Types ──────────────────────────────────────────────────────

export interface MercadoPagoOrderPayment {
  id: string;
  amount: string;
  status: string;
  status_detail: string;
  payment_method: {
    id: string;
    type: string;
    ticket_url: string;
    qr_code: string;
    qr_code_base64: string;
  };
}

export interface MercadoPagoOrderResponse {
  id: string;
  status: string;
  status_detail: string;
  total_amount: string;
  created_date: string;
  last_updated_date: string;
  transactions: {
    payments: MercadoPagoOrderPayment[];
  };
}

// ─── Normalized return types ───────────────────────────────────────────────

export interface PixPaymentResult {
  orderId: string;
  paymentId: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
}

export interface PixPaymentStatusResult {
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  paymentStatusDetail: string;
}

// ─── Service functions ─────────────────────────────────────────────────────

export async function createPixPayment(
  amount: number,
  description: string,
  idempotencyKey: string,
): Promise<PixPaymentResult> {
  logger.info({ amount, description, idempotencyKey }, 'Creating Mercado Pago Pix order');

  const isTestMode = env.NODE_ENV !== 'production';

  const response = await mpClient.post<MercadoPagoOrderResponse>(
    '/v1/orders',
    {
      type: 'online',
      external_reference: idempotencyKey,
      total_amount: amount.toFixed(2),
      description,
      payer: {
        email: env.PIX_PAYER_EMAIL,
        ...(isTestMode && { first_name: 'APRO' }),
      },
      transactions: {
        payments: [
          {
            amount: amount.toFixed(2),
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
            },
          },
        ],
      },
    },
    {
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
    }
  );

  const order = response.data;
  const payment = order.transactions.payments[0];

  logger.info(
    { orderId: order.id, paymentId: payment?.id, status: order.status },
    'Mercado Pago order created'
  );

  return {
    orderId: order.id,
    paymentId: payment?.id || '',
    status: order.status,
    qrCode: payment?.payment_method?.qr_code || '',
    qrCodeBase64: payment?.payment_method?.qr_code_base64 || '',
    ticketUrl: payment?.payment_method?.ticket_url || '',
  };
}

export async function getOrderStatus(orderId: string): Promise<PixPaymentStatusResult> {
  const response = await mpClient.get<MercadoPagoOrderResponse>(
    `/v1/orders/${orderId}`
  );

  const order = response.data;
  const payment = order.transactions?.payments?.[0];

  return {
    orderId: order.id,
    orderStatus: order.status,
    paymentStatus: payment?.status || order.status,
    paymentStatusDetail: payment?.status_detail || order.status_detail,
  };
}

export function validateWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string
): boolean {
  const secret = env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn('MERCADO_PAGO_WEBHOOK_SECRET not configured, skipping signature validation');
    return true;
  }

  if (!xSignature || !xRequestId) {
    return false;
  }

  const parts = xSignature.split(',');
  let ts: string | undefined;
  let hash: string | undefined;

  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    if (key === 'ts') ts = value;
    if (key === 'v1') hash = value;
  }

  if (!ts || !hash) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}
