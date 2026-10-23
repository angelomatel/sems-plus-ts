import { asRecords, isRecord } from '../core/json.js';
import { ApiResource } from '../core/resource.js';
import { toAlarm, toAlarmCounts } from '../mappers/alarm.js';
import type { Alarm, AlarmCounts } from '../types/domain.js';

export class Alarms extends ApiResource {
  async counts(stationId: string): Promise<AlarmCounts> {
    const data = await this.requester.request({
      method: 'POST',
      path: '/sems-alarm/api/alarm/statistics',
      body: { stationIds: [stationId] },
    });
    return toAlarmCounts(data);
  }

  /** The most recent alarms, active and recovered. */
  async list(stationId: string, options: { pageSize?: number } = {}): Promise<Alarm[]> {
    const data = await this.requester.request({
      method: 'POST',
      path: '/sems-alarm/api/v2/alarm/page',
      body: { pageIndex: 1, pageSize: options.pageSize ?? 20, stationIds: [stationId] },
    });
    const rows = isRecord(data) ? asRecords(data.dataList) : [];
    return rows.map(toAlarm).filter((alarm): alarm is Alarm => alarm !== null);
  }
}
