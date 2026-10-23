import { PAGE_SIZE, collectPages } from '../core/pagination.js';
import { ApiResource } from '../core/resource.js';
import { toDeviceDetails, toDeviceInformation, toDevices, toFactors } from '../mappers/device.js';
import type { Device, DeviceDetails, DeviceInformation, FactorValue } from '../types/domain.js';

/** Enough of a `Device` to address it. */
export type DeviceRef = Pick<Device, 'sn' | 'deviceType'>;

export class Devices extends ApiResource {
  /** Every device on the station, with its status. */
  async list(stationId: string): Promise<Device[]> {
    const data = await this.requester.request({
      method: 'GET',
      path: '/sems-plant/api/stations/device/all-status',
      query: { stationId },
    });
    return toDevices(data);
  }

  /** Model and brand of every device on the station. */
  details(stationId: string): Promise<DeviceDetails[]> {
    return collectPages(
      (page) =>
        this.requester.request({
          method: 'POST',
          path: '/sems-plant/api/web/device/station/page',
          body: { stationId, current: page, size: PAGE_SIZE },
        }),
      toDeviceDetails,
    );
  }

  /** A device's information panel: model, firmware, rated power. */
  async information(stationId: string, device: DeviceRef): Promise<DeviceInformation> {
    return toDeviceInformation(await this.equipment('information', stationId, device));
  }

  /** Live values keyed by factor code (`pAc`, `MPPT-1:Vpv`, `soc`, ...). */
  async telemetry(stationId: string, device: DeviceRef): Promise<Record<string, FactorValue>> {
    return toFactors(await this.equipment('telemetry', stationId, device));
  }

  /** Energy counters keyed by factor code (`proPvStatsToday`, ...). */
  async counters(stationId: string, device: DeviceRef): Promise<Record<string, FactorValue>> {
    return toFactors(await this.equipment('telecounting', stationId, device));
  }

  private equipment(kind: string, stationId: string, device: DeviceRef): Promise<unknown> {
    return this.requester.request({
      method: 'GET',
      path: `/sems-plant/api/equipments/${encodeURIComponent(device.sn)}/${kind}`,
      query: { deviceType: device.deviceType, pwId: stationId },
    });
  }
}
