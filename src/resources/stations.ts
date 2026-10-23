import { PAGE_SIZE, collectPages } from '../core/pagination.js';
import { ApiResource } from '../core/resource.js';
import { toPowerFlow, toStation, toStationInfo } from '../mappers/station.js';
import type { PowerFlow, Station, StationInfo } from '../types/domain.js';

export class Stations extends ApiResource {
  /** Every station the account can see. */
  list(): Promise<Station[]> {
    return collectPages(
      (page) =>
        this.requester.request({
          method: 'POST',
          path: '/sems-plant/api/portal/stations/page',
          body: { current: page, size: PAGE_SIZE },
        }),
      toStation,
    );
  }

  async info(stationId: string): Promise<StationInfo> {
    const data = await this.requester.request({
      method: 'POST',
      path: '/sems-plant/api/app/v2/stations/basic/info',
      query: { stationId },
      body: {},
    });
    return toStationInfo(data, stationId);
  }

  /** Live power through the station right now. */
  async powerFlow(stationId: string): Promise<PowerFlow> {
    const data = await this.requester.request({
      method: 'GET',
      path: '/sems-plant/api/stations/flow',
      query: { stationId },
    });
    return toPowerFlow(data);
  }
}
