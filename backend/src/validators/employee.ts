import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().max(20).optional(),
  cpf: z.string().regex(/^\d{11}$/, 'CPF must have 11 digits'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyId: z.string().min(1, 'Company is required'),
  cardNumber: z.string().min(1).max(50).optional(),
});

// SUPER_ADMIN only - includes cardNumber and email
export const updateEmployeeAdminSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  isActive: z.boolean().optional(),
  cardNumber: z.string().min(1).max(50).nullable().optional(),
});

// COMPANY_VIEWER - can edit email but not cardNumber
export const updateEmployeeViewerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const adjustBalanceSchema = z.object({
  amount: z.number().refine((val) => val !== 0, 'Amount cannot be zero'),
  description: z.string().min(1, 'Description is required').max(500),
  idempotencyKey: z.string().optional(),
});

// Employee self-service update (used by EMPLOYEE role)
export const updateEmployeeSelfSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeAdminInput = z.infer<typeof updateEmployeeAdminSchema>;
export type UpdateEmployeeViewerInput = z.infer<typeof updateEmployeeViewerSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
export type UpdateEmployeeSelfInput = z.infer<typeof updateEmployeeSelfSchema>;
