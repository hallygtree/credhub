import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    // Don't redirect on 401 for auth endpoints (login, register, etc.)
    const isAuthEndpoint = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export async function login(email: string, password: string) {
  const response = await api.post<ApiResponse<{ user: unknown; token: string }>>('/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function getMe() {
  const response = await api.get<ApiResponse<{ user: unknown }>>('/auth/me');
  return response.data;
}

export async function getAdminOverview() {
  const response = await api.get('/admin/overview');
  return response.data;
}

export async function getAllTransactions(page = 1, limit = 100) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await api.get(`/admin/transactions?${params}`);
  return response.data;
}

export async function getCompanies() {
  const response = await api.get('/admin/companies');
  return response.data;
}

export async function createCompany(data: {
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  viewerEmail: string;
  viewerPassword: string;
  viewerName: string;
}) {
  const response = await api.post('/admin/companies', data);
  return response.data;
}

export async function getCompany(companyId: string) {
  const response = await api.get(`/admin/companies/${companyId}`);
  return response.data;
}

export async function updateCompany(companyId: string, data: {
  name?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}) {
  const response = await api.put(`/admin/companies/${companyId}`, data);
  return response.data;
}

export async function getCompanyViewer(companyId: string) {
  const response = await api.get(`/admin/companies/${companyId}/viewer`);
  return response.data;
}

export async function updateCompanyViewer(companyId: string, data: {
  name?: string;
  email?: string;
  password?: string;
}) {
  const response = await api.put(`/admin/companies/${companyId}/viewer`, data);
  return response.data;
}

export async function getCompanyEmployees(companyId: string, page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  const response = await api.get(`/admin/companies/${companyId}/employees?${params}`);
  return response.data;
}

export async function getCompanyTransactions(companyId: string, page = 1, limit = 10) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await api.get(`/admin/companies/${companyId}/transactions?${params}`);
  return response.data;
}

export async function getCompanyOverview() {
  const response = await api.get('/company/overview');
  return response.data;
}

export async function getMyCompanyEmployees(page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  const response = await api.get(`/company/employees?${params}`);
  return response.data;
}

export async function createMyEmployee(data: { name: string; phone?: string; cpf: string; email: string; password: string }) {
  const response = await api.post('/company/employees', data);
  return response.data;
}

export async function getEmployeeDetail(employeeId: string) {
  const response = await api.get(`/company/employees/${employeeId}`);
  return response.data;
}

export async function deleteMyEmployee(employeeId: string) {
  const response = await api.delete(`/company/employees/${employeeId}`);
  return response.data;
}

// Admin employee management
export async function updateAdminEmployee(employeeId: string, data: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  isActive?: boolean;
  cardNumber?: string;
}) {
  const response = await api.put(`/admin/employees/${employeeId}`, data);
  return response.data;
}

// Auth - Change password
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const response = await api.post('/auth/change-password', data);
  return response.data;
}

// Auth - Register CPF user (public)
export async function registerCpfUser(data: {
  name: string;
  phone: string;
  cpf: string;
  birthDate: string;
  email: string;
  password: string;
}) {
  const response = await api.post('/auth/register', data);
  return response.data;
}

// Admin - Get subscribers (companies + CPF users)
export async function getSubscribers() {
  const response = await api.get('/admin/subscribers');
  return response.data;
}

// Admin - Get CPF user detail (info + transactions)
export async function getCpfUser(userId: string) {
  const response = await api.get(`/admin/cpf-users/${userId}`);
  return response.data;
}

// Admin - Update CPF user card number
export async function updateCpfUserCard(userId: string, cardNumber: string | null) {
  const response = await api.put(`/admin/cpf-users/${userId}/card`, { cardNumber });
  return response.data;
}

// Admin - Search card holders by card number (partial, case-insensitive)
export async function searchByCardNumber(searchTerm: string) {
  const response = await api.get(`/admin/card/${encodeURIComponent(searchTerm)}`);
  return response.data;
}

// Admin - Register purchase by card number
export async function registerPurchaseByCard(data: { cardNumber: string; amount: number; description: string }) {
  const response = await api.post('/admin/purchase', data);
  return response.data;
}

export async function exportTransactionsCsv(start?: string, end?: string): Promise<Blob> {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const response = await api.get(`/admin/reports/transactions?${params}`, {
    responseType: 'blob',
  });
  return response.data;
}

// User self-service (unified for EMPLOYEE and CPF_USER)
export async function getUserMe() {
  const response = await api.get('/user/me');
  return response.data;
}

export async function getUserTransactions(page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await api.get(`/user/transactions?${params}`);
  return response.data;
}

export async function updateUserMe(data: {
  name?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  const response = await api.put('/user/me', data);
  return response.data;
}

// Pix Payments
export async function createPixPayment(data: { amount: number }) {
  const response = await api.post('/payments/pix', data);
  return response.data;
}

export async function createCompanyPixPayment(data: { amountPerEmployee: number; employeeIds: string[] }) {
  const response = await api.post('/payments/pix', data);
  return response.data;
}

export async function getPixPaymentStatus(paymentId: string) {
  const response = await api.get(`/payments/${paymentId}/status`);
  return response.data;
}

export async function getUserPayments(page = 1, limit = 10) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await api.get(`/payments?${params}`);
  return response.data;
}
