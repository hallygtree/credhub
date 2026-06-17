/**
 * Money — Value Object that stores monetary values as integer cents.
 *
 * Eliminates float-point rounding errors in financial arithmetic.
 * All internal calculations use integer arithmetic (centavos).
 * Boundary methods toReais() / toCents() are used at DB / API edges.
 *
 * Usage:
 *   const a = Money.fromReais(10.50);  // stores 1050 internally
 *   const b = Money.fromReais(0.10);   // stores 10 internally
 *   a.add(b).toReais();                // 10.60 (no float error)
 */
export class Money {
  private readonly _cents: number;

  private constructor(cents: number) {
    this._cents = Math.round(cents); // guarantee integer
  }

  // ─── Factory ─────────────────────────────────────────────────────────────

  static fromReais(reais: number): Money {
    return new Money(reais * 100);
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  // ─── Arithmetic ───────────────────────────────────────────────────────────

  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  subtract(other: Money): Money {
    return new Money(this._cents - other._cents);
  }

  /**
   * Multiply by a scalar (e.g., employee count).
   * Factor must be an integer to maintain cent-safe arithmetic.
   */
  multiply(factor: number): Money {
    return new Money(this._cents * Math.round(factor));
  }

  // ─── Comparisons ─────────────────────────────────────────────────────────

  equals(other: Money): boolean {
    return this._cents === other._cents;
  }

  greaterThan(other: Money): boolean {
    return this._cents > other._cents;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this._cents >= other._cents;
  }

  lessThan(other: Money): boolean {
    return this._cents < other._cents;
  }

  isPositive(): boolean {
    return this._cents > 0;
  }

  isNegative(): boolean {
    return this._cents < 0;
  }

  isZero(): boolean {
    return this._cents === 0;
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  /** Returns value in reais as a float (for DB storage and API responses). */
  toReais(): number {
    return this._cents / 100;
  }

  /** Returns value in centavos (integer). */
  toCents(): number {
    return this._cents;
  }

  toString(): string {
    return `R$${this.toReais().toFixed(2)}`;
  }
}
