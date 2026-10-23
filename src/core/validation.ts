import { isDay } from './json.js';

export function assertDay(value: string, name: string): void {
  if (!isDay(value)) throw new RangeError(`${name} must be a date written as YYYY-MM-DD, got "${value}"`);
}
