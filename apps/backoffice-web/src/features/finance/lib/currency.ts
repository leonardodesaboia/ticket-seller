/**
 * Formats a minor units value (e.g. centavos) as a BRL currency string.
 * Example: formatCurrency('10050', 'BRL') => 'R$ 100,50'
 */
export function formatCurrency(minorUnits: string, currency = 'BRL'): string {
  const numeric = Number(minorUnits);
  const major = numeric / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(major);
}
