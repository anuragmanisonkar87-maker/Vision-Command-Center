// Reusable inline validation helpers. Return string error or null.

export function validateRequired(value: unknown, label = "This field"): string | null {
  if (value === null || value === undefined) return `${label} is required.`;
  if (typeof value === "string" && !value.trim()) return `${label} is required.`;
  return null;
}

export function validateAmount(value: number, opts: { min?: number; max?: number; label?: string } = {}): string | null {
  const { min = 0, max = 1e12, label = "Amount" } = opts;
  if (!Number.isFinite(value)) return `${label} must be a number.`;
  if (value < min) return `${label} cannot be less than ${min}.`;
  if (value > max) return `${label} is too large.`;
  return null;
}

export function validateMonth(value: string): string | null {
  if (!value) return "Month is required.";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return "Format: YYYY-MM";
  return null;
}

export function validateNoDuplicateMonthlyEntry(
  existingId: string | null | undefined,
  match: { id: string } | null | undefined,
): string | null {
  if (match && match.id !== existingId) {
    return "An entry already exists for this client + month.";
  }
  return null;
}
