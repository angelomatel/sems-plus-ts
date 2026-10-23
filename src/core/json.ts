/**
 * Lenient readers for SEMS+ JSON.
 *
 * The API sends the same field as a string on one endpoint and a number on
 * another, so every reader returns null for missing or malformed values rather
 * than throwing.
 */

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecords(value: unknown): JsonRecord[] {
  return asArray(value).filter(isRecord);
}

/** A finite number, or null. Numeric strings are accepted. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toInteger(value: unknown): number | null {
  const number = toNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

/** A non-empty string, or null. */
export function toText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** The `YYYY-MM-DD` part of a timestamp such as "2026-03-05T09:17:41.69". */
export function toDay(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 10) return null;
  const day = value.slice(0, 10);
  return isDay(day) ? day : null;
}

export function fromEpochMs(value: unknown): Date | null {
  const millis = toInteger(value);
  return millis ? new Date(millis) : null;
}
