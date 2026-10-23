import { asRecords, isRecord, toNumber, toText } from '../core/json.js';
import type { PowerCurve, PowerSample } from '../types/domain.js';
import type { RawPowerCurve, RawPowerPoint, RawPowerSeries } from '../types/raw.js';
import { importPositive } from './station.js';

type PowerField = Exclude<keyof PowerSample, 'time'>;

const FIELDS: Record<string, PowerField> = {
  pSystem: 'pv',
  pConsum: 'load',
  pBat: 'battery',
  pGrid: 'grid',
  soc: 'soc',
};

/** The `items` to request so every `PowerSample` field is filled. */
export const POWER_CURVE_ITEMS = Object.keys(FIELDS);

/**
 * Pivot SEMS+'s one-series-per-item curve into one sample per minute,
 * applying this package's sign conventions.
 */
export function toPowerCurve(data: unknown, date: string): PowerCurve {
  const raw: RawPowerCurve = isRecord(data) ? data : {};
  const samples = new Map<string, PowerSample>();
  for (const series of asRecords(raw.dataList) as RawPowerSeries[]) {
    const field = typeof series.item === 'string' ? FIELDS[series.item] : undefined;
    if (field === undefined) continue;
    for (const point of asRecords(series.powerData) as RawPowerPoint[]) {
      const time = toText(point.tp);
      if (time === null) continue;
      const sample = samples.get(time) ?? emptySample(time);
      sample[field] = normalise(field, toNumber(point.power));
      samples.set(time, sample);
    }
  }
  return {
    date,
    samples: [...samples.values()].sort((a, b) => a.time.localeCompare(b.time)),
  };
}

function normalise(field: PowerField, value: number | null): number | null {
  if (value === null) return null;
  if (field === 'grid') return importPositive(value);
  if (field === 'load') return Math.abs(value);
  return value;
}

function emptySample(time: string): PowerSample {
  return { time, pv: null, load: null, battery: null, grid: null, soc: null };
}
