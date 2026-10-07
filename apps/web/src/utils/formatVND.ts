const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Display only: accepts API decimal strings without changing stored amounts. */
export function formatVND(amount: unknown): string {
  const value = typeof amount === 'number' || typeof amount === 'string'
    ? Number(amount)
    : 0;
  return vndFormatter.format(Number.isFinite(value) ? (value === 0 ? 0 : value) : 0);
}
