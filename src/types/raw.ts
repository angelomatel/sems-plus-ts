/**
 * Wire shapes, as SEMS+ sends them.
 *
 * Every field is `unknown` because SEMS+ is inconsistent about types; the
 * mappers read them leniently. Naming the fields here still makes a misspelt
 * field a compile error.
 */

export interface RawStation {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  installedPower?: unknown;
  timeZone?: unknown;
  isShared?: unknown;
}

export interface RawStationInfo {
  stationId?: unknown;
  name?: unknown;
  status?: unknown;
  gridStatus?: unknown;
  isAllInOne?: unknown;
  batteryCapacity?: unknown;
  pvCapacity?: unknown;
  timeZone?: unknown;
  permissions?: unknown;
  createTime?: unknown;
  /** `{energy_flow: "pSystem,pBat,..."}` */
  chartMap?: unknown;
}

/** `stations/flow`; powers in kW, `pGrid` positive while exporting. */
export interface RawPowerFlow {
  pSystem?: unknown;
  pAc?: unknown;
  pBat?: unknown;
  pGrid?: unknown;
  pConsum?: unknown;
  soc?: unknown;
  refreshTime?: unknown;
  time?: unknown;
  pThird?: unknown;
  pEvChar?: unknown;
  pHeatPump?: unknown;
  pDiesel?: unknown;
}

/** `stations/device/all-status`: devices grouped by type, then by status. */
export interface RawDeviceStatus {
  deviceDetailList?: unknown;
}

export interface RawDeviceTypeGroup {
  deviceType?: unknown;
  statusDetailList?: unknown;
}

export interface RawDeviceStatusGroup {
  status?: unknown;
  snList?: unknown;
  /** Keyed by serial: `{name, preSn, subtype}`. */
  detailMap?: unknown;
}

export interface RawDeviceDetail {
  name?: unknown;
  preSn?: unknown;
  subtype?: unknown;
}

export interface RawDeviceRow {
  sn?: unknown;
  model?: unknown;
  brand?: unknown;
}

/** One row of an equipment `information` panel. */
export interface RawInformationRow {
  code?: unknown;
  data?: unknown;
}

/** A group of telemetry or counter factors. */
export interface RawFactorGroup {
  factors?: unknown;
}

export interface RawFactor {
  code?: unknown;
  data?: unknown;
  dataType?: unknown;
}

/** `stations/statistics`: one series per requested item, values in kWh. */
export interface RawStatistics {
  dataList?: unknown;
}

export interface RawStatisticsSeries {
  item?: unknown;
  unit?: unknown;
  statisticsList?: unknown;
}

export interface RawStatisticsPoint {
  /** `YYYY-MM-DD` for days, `YYYY-MM` for months, `YYYY` for years. */
  date?: unknown;
  val?: unknown;
}

/** `hems/power/statisticsAndPreV2`: one series per item, one point per minute. */
export interface RawPowerCurve {
  dataList?: unknown;
}

export interface RawPowerSeries {
  item?: unknown;
  unit?: unknown;
  powerData?: unknown;
}

export interface RawPowerPoint {
  /** Local station time, `YYYY-MM-DD HH:mm:ss`. */
  tp?: unknown;
  power?: unknown;
}

export interface RawAlarmCounts {
  total?: unknown;
  happened?: unknown;
  recovery?: unknown;
}

export interface RawAlarm {
  warningid?: unknown;
  warning_code?: unknown;
  warningNameEn?: unknown;
  alarmLevel?: unknown;
  /** 0 = occurring, 1 = recovered. */
  status?: unknown;
  devicesn?: unknown;
  deviceName?: unknown;
  happentime?: unknown;
  recoverytime?: unknown;
}
