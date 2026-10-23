import { asArray, isRecord, toDay, toInteger, toNumber, toText } from '../core/json.js';
import type { PowerFlow, Station, StationInfo } from '../types/domain.js';
import type { RawPowerFlow, RawStation, RawStationInfo } from '../types/raw.js';

export function toStation(raw: RawStation): Station | null {
  const id = toText(raw.id);
  if (id === null) return null;
  return {
    id,
    name: toText(raw.name) ?? id,
    status: toInteger(raw.status),
    capacityKw: toNumber(raw.installedPower),
    timeZone: toText(raw.timeZone),
    isShared: Boolean(raw.isShared),
  };
}

/** `stationId` is the one requested, used when the response omits it. */
export function toStationInfo(data: unknown, stationId: string): StationInfo {
  const raw: RawStationInfo = isRecord(data) ? data : {};
  const id = toText(raw.stationId) ?? stationId;
  const gridStatus = toInteger(raw.gridStatus);
  return {
    id,
    name: toText(raw.name) ?? id,
    status: toInteger(raw.status),
    onGrid: gridStatus === null ? null : gridStatus === 1,
    isAllInOne: Boolean(raw.isAllInOne),
    batteryCapacityKwh: toNumber(raw.batteryCapacity),
    pvCapacityKw: toNumber(raw.pvCapacity),
    timeZone: toText(raw.timeZone),
    permissions: asArray(raw.permissions).filter((p): p is string => typeof p === 'string'),
    created: toDay(raw.createTime),
    flowItems: flowItems(raw.chartMap),
  };
}

function flowItems(chartMap: unknown): string[] {
  const items = isRecord(chartMap) ? chartMap.energy_flow : undefined;
  if (typeof items !== 'string') return [];
  return items
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toPowerFlow(data: unknown): PowerFlow {
  const raw: RawPowerFlow = isRecord(data) ? data : {};
  const load = toNumber(raw.pConsum);
  return {
    pv: toNumber(raw.pSystem ?? raw.pAc),
    battery: toNumber(raw.pBat),
    grid: importPositive(toNumber(raw.pGrid)),
    load: load === null ? null : Math.abs(load),
    soc: toNumber(raw.soc),
    updatedAt: toText(raw.refreshTime) ?? toText(raw.time),
    thirdPartyPv: toNumber(raw.pThird),
    evCharger: toNumber(raw.pEvChar),
    heatPump: toNumber(raw.pHeatPump),
    generator: toNumber(raw.pDiesel),
  };
}

/** SEMS+ reports grid power positive while exporting; flip it, without making -0. */
export function importPositive(grid: number | null): number | null {
  return grid === null || grid === 0 ? grid : -grid;
}
