import { z } from 'zod';
import { env } from '../config/env.js';

export const createPixPaymentSchema = z.object({
  amount: z
    .number()
    .positive('Valor deve ser maior que zero')
    .max(env.PIX_MAX_AMOUNT, `Valor máximo: R$ ${env.PIX_MAX_AMOUNT.toFixed(2)}`),
});

export const createCompanyPixPaymentSchema = z.object({
  amountPerEmployee: z
    .number()
    .positive('Valor por colaborador deve ser maior que zero'),
  employeeIds: z
    .array(z.string().min(1))
    .min(1, 'Selecione pelo menos um colaborador'),
}).refine(
  (data) => data.amountPerEmployee * data.employeeIds.length <= env.PIX_MAX_AMOUNT,
  {
    message: `Valor total excede o máximo permitido de R$ ${env.PIX_MAX_AMOUNT.toFixed(2)}`,
    path: ['amountPerEmployee'],
  }
);
