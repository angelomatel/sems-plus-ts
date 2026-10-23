import { ApiResource } from '../core/resource.js';
import { assertDay } from '../core/validation.js';
import { STATISTICS_ITEMS, toEnergyStatistics } from '../mappers/statistics.js';
import type { EnergyStatistics, StatisticsDimension } from '../types/domain.js';

export interface StatisticsQuery {
  /** One row per day, month or year. */
  dimension: StatisticsDimension;
  /** First day, `YYYY-MM-DD`, inclusive. */
  from: string;
  /** Last day, `YYYY-MM-DD`, inclusive. */
  to: string;
}

export class Statistics extends ApiResource {
  /**
   * Energy totals per period, in kWh.
   *
   * SEMS+ answers a range spanning more than one calendar year with zeros, so
   * fetch long histories one year at a time. Nothing exists before the
   * station's `created` day.
   */
  async get(stationId: string, query: StatisticsQuery): Promise<EnergyStatistics> {
    assertDay(query.from, 'from');
    assertDay(query.to, 'to');
    const data = await this.requester.request({
      method: 'POST',
      path: '/sems-plant/api/stations/statistics',
      body: {
        stationId,
        isReport: false,
        items: STATISTICS_ITEMS,
        dimension: query.dimension,
        startTime: `${query.from} 00:00:00`,
        endTime: `${query.to} 23:59:59`,
      },
    });
    return toEnergyStatistics(data, query.dimension);
  }
}
