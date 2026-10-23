/**
 * The public models. Values a station does not report are null.
 *
 * Sign conventions, everywhere in this package: `battery` is positive while
 * discharging, `grid` is positive while importing, `load` is a magnitude.
 */

export interface Station {
  id: string;
  name: string;
  status: number | null;
  capacityKw: number | null;
  timeZone: string | null;
  isShared: boolean;
}

export interface StationInfo {
  id: string;
  name: string;
  status: number | null;
  /** null for PV-only stations, which report no grid connection. */
  onGrid: boolean | null;
  isAllInOne: boolean;
  batteryCapacityKwh: number | null;
  pvCapacityKw: number | null;
  timeZone: string | null;
  permissions: string[];
  /** `YYYY-MM-DD`; statistics only exist from this day on. */
  created: string | null;
  /** The power-flow fields this station has (`pSystem`, `pThird`, ...). */
  flowItems: string[];
}

/** Live station power, in kW. */
export interface PowerFlow {
  pv: number | null;
  battery: number | null;
  grid: number | null;
  load: number | null;
  /** Battery state of charge, %. */
  soc: number | null;
  updatedAt: string | null;
  thirdPartyPv: number | null;
  evCharger: number | null;
  heatPump: number | null;
  generator: number | null;
}

export type DeviceType =
  | 'INVERTER'
  | 'ENERGY_STORAGE_INTEGRATED_CABINET'
  | 'BATTERY_RACK'
  | 'SMART_METER'
  | 'DONGLE'
  | (string & {});

export interface Device {
  sn: string;
  name: string;
  deviceType: DeviceType;
  status: number | null;
  /** The inverter a smart meter hangs off. */
  parentSn: string | null;
  subtype: string | null;
}

export interface DeviceDetails {
  sn: string;
  model: string | null;
  brand: string | null;
}

export interface DeviceInformation {
  model: string | null;
  /** The inverter firmware (SEMS+ "safety version") or a dongle's module version. */
  firmware: string | null;
  ratedPowerKw: number | null;
  /** A dongle's link: "LAN" or "WiFi". */
  connection: string | null;
  onGrid: boolean | null;
}

/** A telemetry or counter value. A factor the device lacks is kept as null. */
export type FactorValue = number | string | null;

export type StatisticsDimension = 'day' | 'month' | 'year';

/** Energy over one period, in kWh. */
export interface EnergyPeriod {
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY`, per the requested dimension. */
  period: string;
  pv: number | null;
  consumption: number | null;
  gridImport: number | null;
  gridExport: number | null;
  selfConsumption: number | null;
  batteryCharge: number | null;
  batteryDischarge: number | null;
}

export interface EnergyStatistics {
  dimension: StatisticsDimension;
  /** Oldest first. */
  periods: EnergyPeriod[];
}

/** One minute of station power. */
export interface PowerSample {
  /** Local station time, `YYYY-MM-DD HH:mm:ss`. */
  time: string;
  /** kW */
  pv: number | null;
  /** kW */
  load: number | null;
  /** kW, positive while discharging. */
  battery: number | null;
  /** kW, positive while importing. */
  grid: number | null;
  /** % */
  soc: number | null;
}

export interface PowerCurve {
  /** `YYYY-MM-DD` */
  date: string;
  /** Oldest first; the portal returns one per minute. */
  samples: PowerSample[];
}

export interface AlarmCounts {
  total: number;
  active: number;
  recovered: number;
}

export interface Alarm {
  id: string;
  code: string | null;
  name: string;
  level: string | null;
  active: boolean;
  deviceSn: string | null;
  deviceName: string | null;
  happenedAt: Date | null;
  recoveredAt: Date | null;
}
