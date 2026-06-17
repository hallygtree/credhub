import { z } from 'zod';

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const updateEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required for verification'),
});

export const registerCpfUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  phone: z.string().min(10, 'Phone must have at least 10 digits').max(15, 'Phone cannot exceed 15 digits'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF must have exactly 11 digits'),
  birthDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime()) && parsed < new Date();
  }, 'Invalid birth date'),
  email: z.string().email('Invalid email format'),
  password: strongPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type RegisterCpfUserInput = z.infer<typeof registerCpfUserSchema>;
