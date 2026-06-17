/**
 * Data masking utilities for LGPD-compliant logs.
 * Sensitive data (CPF, email, card, JWT, tokens) must NEVER appear unmasked in logs.
 */

/**
 * Masks a CPF, hiding the first 3 digits and the 3 digits before the hyphen.
 * "12345678901" → "***.456.***-01"
 */
export function maskCpf(cpf: string | undefined | null): string {
  if (!cpf) return '***.***.***-**';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
}

/**
 * Masks an email, preserving first 2 chars and domain TLD.
 * "joao.silva@empresa.com" → "jo***@***.com"
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return '***@***';
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const maskedLocal = local.slice(0, 2).padEnd(local.length, '*');
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  return `${maskedLocal}@***.${tld}`;
}

/**
 * Masks a card number, showing only last 4 digits.
 * "1234567890123456" → "************3456"
 */
export function maskCardNumber(card: string | undefined | null): string {
  if (!card) return '****';
  const digits = card.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * Truncates a JWT or Bearer token to first 8 chars.
 * Prevents tokens from leaking into logs.
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '[no-token]';
  const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
  return `${raw.slice(0, 8)}…[redacted]`;
}

/**
 * Masks a CNPJ, hiding the first 2 digits and the 3rd group before the slash.
 * "12345678000100" → "**.345.nnn/0001-00"
 */
export function maskCnpj(cnpj: string | undefined | null): string {
  if (!cnpj) return '**.***.****/****-**';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return '**.***.****/****-**';
  return `**.${digits.slice(2, 5)}.***/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
