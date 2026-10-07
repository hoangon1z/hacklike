const vndIntl = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

/** Standard integer VND formatter: e.g. 1000000 => 1.000.000 ₫ */
export function formatVND(amount: unknown, maximumFractionDigits = 0): string {
  const value = typeof amount === 'number' || typeof amount === 'string'
    ? Number(amount)
    : 0;
  const safeValue = Number.isFinite(value) ? (value === 0 ? 0 : value) : 0;
  if (maximumFractionDigits === 0) {
    return `${vndIntl.format(Math.round(safeValue))} ₫`;
  }
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(safeValue)} ₫`;
}

/** Formats the price for 1 interaction (e.g. 22 ₫ or 14,994 ₫) */
export function formatUnitVND(ratePer1000: number): string {
  const unit = ratePer1000 / 1000;
  if (Number.isInteger(unit)) {
    return `${vndIntl.format(unit)} ₫`;
  }
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(unit)} ₫`;
}

/** Formats raw unit rate number for input (e.g. 22 or 14.994) */
export function formatUnitNumber(ratePer1000: number): string {
  const unit = ratePer1000 / 1000;
  if (Number.isInteger(unit)) {
    return String(unit);
  }
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(unit);
}

/** Canonical rate per 1.000 interactions: e.g. 14.994 ₫ */
export function formatRate1000(ratePer1000: number): string {
  return `${vndIntl.format(Math.round(ratePer1000))} ₫`;
}
