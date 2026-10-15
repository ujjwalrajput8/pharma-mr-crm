/** Indian-rupee display helpers — lakh/crore digit grouping via en-IN. */

export function formatINR(value: number): string {
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole-rupee variant for stat tiles where paise are noise. */
export function formatINRCompact(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
