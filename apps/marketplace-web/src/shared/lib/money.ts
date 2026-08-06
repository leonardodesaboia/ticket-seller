// NBSP (U+00A0) and narrow NBSP (U+202F) that Intl inserts before the amount;
// built from char codes to avoid embedding invisible characters in source.
const NON_BREAKING_SPACES = new RegExp(
  `[${String.fromCharCode(0x00a0)}${String.fromCharCode(0x202f)}]`,
  'g',
);

/**
 * Formats an integer amount in minor units (e.g. cents) as a localized currency
 * string. The public API always returns prices in minor units.
 */
export function formatCurrency(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    })
      .format(major)
      .replace(NON_BREAKING_SPACES, ' ');
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
