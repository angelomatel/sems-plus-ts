import { asRecords, isRecord, toInteger, toNumber, toText } from '../core/json.js';
import type { Device, DeviceDetails, DeviceInformation, FactorValue } from '../types/domain.js';
import type {
  RawDeviceDetail,
  RawDeviceRow,
  RawDeviceStatus,
  RawDeviceStatusGroup,
  RawDeviceTypeGroup,
  RawFactor,
  RawFactorGroup,
  RawInformationRow,
} from '../types/raw.js';

/** Flatten the `device/all-status` grouping into one device per serial. */
export function toDevices(data: unknown): Device[] {
  const raw: RawDeviceStatus = isRecord(data) ? data : {};
  const devices: Device[] = [];
  for (const typeGroup of asRecords(raw.deviceDetailList) as RawDeviceTypeGroup[]) {
    const deviceType = toText(typeGroup.deviceType);
    if (deviceType === null) continue;
    for (const statusGroup of asRecords(typeGroup.statusDetailList) as RawDeviceStatusGroup[]) {
      const details = isRecord(statusGroup.detailMap) ? statusGroup.detailMap : {};
      const sns = Array.isArray(statusGroup.snList) ? statusGroup.snList : [];
      for (const sn of sns) {
        if (typeof sn !== 'string') continue;
        const detail: RawDeviceDetail = isRecord(details[sn]) ? details[sn] : {};
        devices.push({
          sn,
          name: toText(detail.name) ?? sn,
          deviceType,
          status: toInteger(statusGroup.status),
          parentSn: toText(detail.preSn),
          subtype: toText(detail.subtype),
        });
      }
    }
  }
  return devices;
}

export function toDeviceDetails(raw: RawDeviceRow): DeviceDetails | null {
  const sn = toText(raw.sn);
  if (sn === null) return null;
  return { sn, model: toText(raw.model), brand: toText(raw.brand) };
}

export function toDeviceInformation(data: unknown): DeviceInformation {
  const fields = new Map<string, unknown>();
  for (const row of asRecords(data) as RawInformationRow[]) {
    if (typeof row.code === 'string') fields.set(row.code, row.data);
  }
  const grid = toText(fields.get('gridConnStu'));
  return {
    model: toText(fields.get('modelType')),
    firmware: toText(fields.get('safetyVersion')) ?? toText(fields.get('commModuleVer')),
    ratedPowerKw: toNumber(fields.get('ratedPower')),
    connection: toText(fields.get('communicationMode')),
    // gridConnStu: "1" on, "0" or "2" off, as the portal shows it.
    onGrid: grid === null ? null : grid === '1',
  };
}

/** Flatten telemetry or counter groups into `{factor code: value}`. */
export function toFactors(data: unknown): Record<string, FactorValue> {
  const factors: Record<string, FactorValue> = {};
  for (const group of asRecords(data) as RawFactorGroup[]) {
    for (const factor of asRecords(group.factors) as RawFactor[]) {
      if (typeof factor.code !== 'string') continue;
      factors[factor.code] =
        factor.dataType === 'STRING' ? toText(factor.data) : toNumber(factor.data);
    }
  }
  return factors;
}
