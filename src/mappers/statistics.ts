import { asRecords, isRecord, toNumber, toText } from '../core/json.js';
import type { EnergyPeriod, EnergyStatistics, StatisticsDimension } from '../types/domain.js';
import type { RawStatistics, RawStatisticsPoint, RawStatisticsSeries } from '../types/raw.js';

type EnergyField = Exclude<keyof EnergyPeriod, 'period'>;

const FIELDS: Record<string, EnergyField> = {
  proSystemTotalStats: 'pv',
  proConsumStats: 'consumption',
  proPurchaseStats: 'gridImport',
  proGridStats: 'gridExport',
  proSelfConsumStats: 'selfConsumption',
  proCharStats: 'batteryCharge',
  proDischarStats: 'batteryDischarge',
};

/** The `items` to request so every `EnergyPeriod` field is filled. */
export const STATISTICS_ITEMS = Object.keys(FIELDS);

/** Pivot SEMS+'s one-series-per-item response into one row per period. */
export function toEnergyStatistics(data: unknown, dimension: StatisticsDimension): EnergyStatistics {
  const raw: RawStatistics = isRecord(data) ? data : {};
  const periods = new Map<string, EnergyPeriod>();
  for (const series of asRecords(raw.dataList) as RawStatisticsSeries[]) {
    const field = typeof series.item === 'string' ? FIELDS[series.item] : undefined;
    if (field === undefined) continue;
    for (const point of asRecords(series.statisticsList) as RawStatisticsPoint[]) {
      const period = toText(point.date);
      const value = toNumber(point.val);
      if (period === null || value === null) continue;
      const row = periods.get(period) ?? emptyPeriod(period);
      row[field] = value;
      periods.set(period, row);
    }
  }
  return {
    dimension,
    periods: [...periods.values()].sort((a, b) => a.period.localeCompare(b.period)),
  };
}

function emptyPeriod(period: string): EnergyPeriod {
  return {
    period,
    pv: null,
    consumption: null,
    gridImport: null,
    gridExport: null,
    selfConsumption: null,
    batteryCharge: null,
    batteryDischarge: null,
  };
}
