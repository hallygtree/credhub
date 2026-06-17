import { IEmployee } from '../models/Employee.js';

// LGPD-compliant DTOs for role-based data exposure

export interface CompanyEmployeeDTO {
  id: string;
  name: string;
  email: string;
  cpf: string;
  cardNumber?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface EmployeeSelfDTO {
  id: string;
  name: string;
  email: string;
  balance: number;
  cardNumber?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  companyName?: string;
}

export function toCompanyEmployeeDTO(employee: IEmployee): CompanyEmployeeDTO {
  return {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email,
    cpf: employee.cpf,
    cardNumber: employee.cardNumber,
    isActive: employee.isActive,
    createdAt: employee.createdAt,
  };
}

export function toEmployeeSelfDTO(
  employee: IEmployee,
  companyName?: string,
  balanceOverride?: number
): EmployeeSelfDTO {
  return {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email,
    balance: balanceOverride !== undefined ? balanceOverride : employee.balance,
    cardNumber: employee.cardNumber,
    phone: employee.phone,
    address: employee.address,
    zipCode: employee.zipCode,
    companyName,
  };
}
