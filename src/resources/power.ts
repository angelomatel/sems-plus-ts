import { ApiResource } from '../core/resource.js';
import { assertDay } from '../core/validation.js';
import { POWER_CURVE_ITEMS, toPowerCurve } from '../mappers/power.js';
import type { PowerCurve } from '../types/domain.js';

export interface PowerCurveOptions {
  /**
   * The `timeZone` field the portal sends: the station's UTC offset in hours
   * with the sign flipped, like `Date#getTimezoneOffset() / 60` (UTC+8 → -8).
   * Defaults to this machine's offset on that date, as the portal does; set it
   * when the code runs in a different zone from the station.
   */
  timeZone?: number;
}

export class Power extends ApiResource {
  /** One day of PV, load, battery, grid and SOC, one sample per minute. */
  async curve(stationId: string, date: string, options: PowerCurveOptions = {}): Promise<PowerCurve> {
    assertDay(date, 'date');
    const timeZone = options.timeZone ?? new Date(`${date}T12:00:00`).getTimezoneOffset() / 60;
    const data = await this.requester.request({
      method: 'POST',
      path: '/sems-plant/api/v1/hems/power/statisticsAndPreV2',
      body: {
        stationId,
        items: POWER_CURVE_ITEMS,
        timeScale: 1,
        timeZone,
        startTime: `${date} 00:00:00`,
        endTime: `${date} 23:59:59`,
      },
    });
    return toPowerCurve(data, date);
  }
}
