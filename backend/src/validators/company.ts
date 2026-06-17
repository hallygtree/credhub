import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ must have 14 digits'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  address: z.string().max(200).optional(),
  viewerEmail: z.string().email('Invalid viewer email format'),
  viewerPassword: z.string().min(8, 'Password must be at least 8 characters'),
  viewerName: z.string().min(1, 'Viewer name is required'),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  address: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
