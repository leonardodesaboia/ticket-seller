import { formatCurrency } from './money';

describe('formatCurrency', () => {
  it('formats minor units as BRL with a normal space', () => {
    expect(formatCurrency(5000, 'BRL')).toBe('R$ 50,00');
    expect(formatCurrency(5000, 'BRL')).not.toContain(String.fromCharCode(0x00a0));
  });

  it('formats zero', () => {
    expect(formatCurrency(0, 'BRL')).toBe('R$ 0,00');
  });

  it('falls back for an invalid currency code', () => {
    expect(formatCurrency(5000, 'INVALID')).toBe('INVALID 50.00');
  });
});
