export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_VIEWER = 'COMPANY_VIEWER',
  EMPLOYEE = 'EMPLOYEE',
  CPF_USER = 'CPF_USER',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  employeeId?: string;
  mustChangePassword: boolean;
}

export interface Subscriber {
  id: string;
  type: 'COMPANY' | 'CPF_USER';
  name: string;
  document: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  cardNumber?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type PixPaymentStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface PixPaymentResponse {
  paymentId: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
  copiaECola: string;
  ticketUrl: string;
  status: PixPaymentStatus;
}

