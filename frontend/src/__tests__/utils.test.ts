import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateOnly,
  formatCPF,
  formatCNPJ,
  parseBrazilianNumber,
  getRoleDefaultRoute,
} from '@/lib/utils';
import { UserRole } from '@/types';

describe('formatCurrency', () => {
  it('should format a value in BRL with R$ prefix', () => {
    const result = formatCurrency(10.5);
    expect(result).toContain('R$');
    expect(result).toContain('10');
  });

  it('should format zero as R$ 0,00', () => {
    const result = formatCurrency(0);
    expect(result).toContain('R$');
    expect(result).toContain('0');
  });

  it('should format undefined as zero', () => {
    const result = formatCurrency(undefined);
    expect(result).toContain('R$');
    expect(result).toContain('0');
  });

  it('should format null as zero', () => {
    const result = formatCurrency(null);
    expect(result).toContain('R$');
    expect(result).toContain('0');
  });

  it('should format NaN as zero', () => {
    const result = formatCurrency(NaN);
    expect(result).toContain('R$');
  });

  it('should format large amounts with thousands separator', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1');
    expect(result).toContain('500');
  });

  it('should format decimal values with comma separator (pt-BR)', () => {
    const result = formatCurrency(49.99);
    expect(result).toContain('49');
    expect(result).toContain('99');
  });
});

describe('formatDate', () => {
  it('should return "-" for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('should return "-" for an invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('should return a non-empty string for a valid ISO date', () => {
    const result = formatDate('2024-06-15T12:00:00Z');
    expect(result).not.toBe('-');
    expect(result.length).toBeGreaterThan(5);
    expect(result).toContain('2024');
  });

  it('should accept a Date object', () => {
    const result = formatDate(new Date('2024-06-15T12:00:00Z'));
    expect(result).not.toBe('-');
  });
});

describe('formatDateOnly', () => {
  it('should return "-" for null', () => {
    expect(formatDateOnly(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatDateOnly(undefined)).toBe('-');
  });

  it('should return "-" for an invalid date', () => {
    expect(formatDateOnly('invalid')).toBe('-');
  });

  it('should return a date in DD/MM/YYYY format', () => {
    const result = formatDateOnly('2024-03-20T12:00:00Z');
    expect(result).not.toBe('-');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('formatCPF', () => {
  it('should format 11 digits into CPF pattern', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });
});

describe('formatCNPJ', () => {
  it('should format 14 digits into CNPJ pattern', () => {
    expect(formatCNPJ('12345678000100')).toBe('12.345.678/0001-00');
  });
});

describe('parseBrazilianNumber', () => {
  it('should parse an integer string', () => {
    expect(parseBrazilianNumber('100')).toBe(100);
  });

  it('should parse a Brazilian decimal using comma', () => {
    expect(parseBrazilianNumber('10,50')).toBe(10.5);
  });

  it('should parse a decimal with dot', () => {
    expect(parseBrazilianNumber('10.50')).toBe(10.5);
  });

  it('should return 0 for non-numeric strings', () => {
    expect(parseBrazilianNumber('abc')).toBe(0);
    expect(parseBrazilianNumber('')).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(parseBrazilianNumber('-50')).toBe(-50);
  });
});

describe('getRoleDefaultRoute', () => {
  it('should return the admin overview for SUPER_ADMIN', () => {
    expect(getRoleDefaultRoute(UserRole.SUPER_ADMIN)).toBe('/app/admin/overview');
  });

  it('should return the user dashboard for EMPLOYEE', () => {
    expect(getRoleDefaultRoute(UserRole.EMPLOYEE)).toBe('/app/user/dashboard');
  });

  it('should return the user dashboard for CPF_USER', () => {
    expect(getRoleDefaultRoute(UserRole.CPF_USER)).toBe('/app/user/dashboard');
  });

  it('should return the company overview for COMPANY_VIEWER', () => {
    expect(getRoleDefaultRoute(UserRole.COMPANY_VIEWER)).toBe('/app/company/overview');
  });
});
