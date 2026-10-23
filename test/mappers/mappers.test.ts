import { describe, expect, it } from 'vitest';
import { toAlarm, toAlarmCounts } from '../../src/mappers/alarm.js';
import { toDeviceInformation, toDevices, toFactors } from '../../src/mappers/device.js';
import { POWER_CURVE_ITEMS, toPowerCurve } from '../../src/mappers/power.js';
import { toPowerFlow, toStation, toStationInfo } from '../../src/mappers/station.js';
import { STATISTICS_ITEMS, toEnergyStatistics } from '../../src/mappers/statistics.js';
import devicesFixture from '../fixtures/device-all-status.json' with { type: 'json' };
import curveFixture from '../fixtures/power-curve.json' with { type: 'json' };
import statisticsFixture from '../fixtures/statistics-day.json' with { type: 'json' };

describe('toPowerCurve', () => {
  const curve = toPowerCurve(curveFixture.data, '2026-10-22');

  it('pivots the series into one sample per minute, oldest first', () => {
    expect(curve.date).toBe('2026-10-22');
    expect(curve.samples.map((s) => s.time)).toEqual([
      '2026-10-22 00:00:00',
      '2026-10-22 12:00:00',
      '2026-10-22 12:01:00',
    ]);
  });

  it('makes grid import positive and load a magnitude', () => {
    expect(curve.samples[0]).toEqual({
      time: '2026-10-22 00:00:00',
      pv: 0,
      load: 1.657,
      battery: 0,
      grid: 1.657,
      soc: 21,
    });
    expect(curve.samples[1]).toEqual({
      time: '2026-10-22 12:00:00',
      pv: 3.6792,
      load: 1.63306,
      battery: -2.09214,
      grid: 0,
      soc: 42,
    });
  });

  it('keeps gaps as null, reads numeric strings, and ignores unknown items', () => {
    expect(curve.samples[2]).toEqual({
      time: '2026-10-22 12:01:00',
      pv: 3.7,
      load: null,
      battery: null,
      grid: -0.25,
      soc: null,
    });
  });

  it('never produces negative zero', () => {
    expect(Object.is(curve.samples[1]?.grid, -0)).toBe(false);
  });

  it('requests exactly the items it maps', () => {
    expect(POWER_CURVE_ITEMS.sort()).toEqual(['pBat', 'pConsum', 'pGrid', 'pSystem', 'soc']);
  });

  it('copes with a malformed payload', () => {
    expect(toPowerCurve(null, '2026-10-22')).toEqual({ date: '2026-10-22', samples: [] });
  });
});

describe('toEnergyStatistics', () => {
  it('pivots the series into one row per period, oldest first', () => {
    expect(toEnergyStatistics(statisticsFixture.data, 'day')).toEqual({
      dimension: 'day',
      periods: [
        {
          period: '2026-10-21',
          pv: 34.3,
          consumption: 37.6,
          gridImport: null,
          gridExport: null,
          selfConsumption: null,
          batteryCharge: null,
          batteryDischarge: null,
        },
        {
          period: '2026-10-22',
          pv: 41.2,
          consumption: 27.8,
          gridImport: 9.6,
          gridExport: 0,
          selfConsumption: 18.3,
          batteryCharge: 11.9,
          batteryDischarge: null,
        },
      ],
    });
  });

  it('requests the seven items the portal requests', () => {
    expect(STATISTICS_ITEMS).toHaveLength(7);
  });
});

describe('toDevices', () => {
  it('flattens the type/status grouping and skips malformed entries', () => {
    expect(toDevices(devicesFixture.data)).toEqual([
      { sn: 'INV0000000001', name: 'Inverter 1', deviceType: 'INVERTER', status: 1, parentSn: null, subtype: null },
      {
        sn: 'MTR0000000001',
        name: 'Meter 1',
        deviceType: 'SMART_METER',
        status: 1,
        parentSn: 'INV0000000001',
        subtype: 'GM1000',
      },
      { sn: 'DNG0000000001', name: 'DNG0000000001', deviceType: 'DONGLE', status: 0, parentSn: null, subtype: null },
    ]);
  });
});

describe('station mappers', () => {
  it('skips stations without an id', () => {
    expect(toStation({ name: 'x' })).toBeNull();
    expect(toStation({ id: 's1', installedPower: '8', isShared: 0 })).toEqual({
      id: 's1',
      name: 's1',
      status: null,
      capacityKw: 8,
      timeZone: null,
      isShared: false,
    });
  });

  it('reads station info, falling back to the requested id', () => {
    const info = toStationInfo(
      {
        name: 'Bahay',
        gridStatus: 1,
        pvCapacity: 8,
        permissions: ['INVERTER_REMOTE_READ', 3],
        createTime: '2026-06-19T08:00:00.12',
        chartMap: { energy_flow: 'pSystem, pBat,,pGrid' },
      },
      'requested-id',
    );
    expect(info).toMatchObject({
      id: 'requested-id',
      name: 'Bahay',
      onGrid: true,
      pvCapacityKw: 8,
      permissions: ['INVERTER_REMOTE_READ'],
      created: '2026-06-19',
      flowItems: ['pSystem', 'pBat', 'pGrid'],
    });
  });

  it('applies the sign conventions to the live power flow', () => {
    expect(toPowerFlow({ pSystem: 5.347, pBat: -3.816, pGrid: -0.014, pConsum: -1.545, soc: 61 })).toMatchObject({
      pv: 5.347,
      battery: -3.816,
      grid: 0.014,
      load: 1.545,
      soc: 61,
    });
    expect(toPowerFlow({ pAc: 2 }).pv).toBe(2);
  });
});

describe('device panels', () => {
  it('reads the information panel', () => {
    expect(
      toDeviceInformation([
        { code: 'modelType', data: 'GW8000-ES-C10' },
        { code: 'safetyVersion', data: '' },
        { code: 'commModuleVer', data: '1.2' },
        { code: 'ratedPower', data: '8' },
        { code: 'gridConnStu', data: '2' },
      ]),
    ).toEqual({ model: 'GW8000-ES-C10', firmware: '1.2', ratedPowerKw: 8, connection: null, onGrid: false });
  });

  it('flattens factors, keeping unsupported ones as null', () => {
    expect(
      toFactors([
        { factors: [{ code: 'pAc', data: '1.5' }, { code: 'mode', data: 'Normal', dataType: 'STRING' }] },
        { factors: [{ code: 'missing', data: null }, { data: 1 }] },
      ]),
    ).toEqual({ pAc: 1.5, mode: 'Normal', missing: null });
  });
});

describe('alarm mappers', () => {
  it('reads counts and alarms', () => {
    expect(toAlarmCounts({ total: 3, happened: '1', recovery: 2 })).toEqual({ total: 3, active: 1, recovered: 2 });
    expect(
      toAlarm({ warningid: 'w1', warning_code: 'F01', status: 0, happentime: 1761200000000, recoverytime: 0 }),
    ).toEqual({
      id: 'w1',
      code: 'F01',
      name: 'F01',
      level: null,
      active: true,
      deviceSn: null,
      deviceName: null,
      happenedAt: new Date(1761200000000),
      recoveredAt: null,
    });
    expect(toAlarm({})).toBeNull();
  });
});
