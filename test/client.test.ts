import { describe, expect, it } from 'vitest';
import { SemsPlus } from '../src/index.js';
import curveFixture from './fixtures/power-curve.json' with { type: 'json' };
import { FakeHttp, HK_API, isLogin, json, loginOk, ok } from './helpers/fake-http.js';

function sems(responder: ConstructorParameters<typeof FakeHttp>[0]) {
  const http = new FakeHttp((request) => (isLogin(request) ? loginOk() : responder(request)));
  return { client: new SemsPlus({ account: 'a', password: 'p', http, requestSpacingMs: 0 }), http };
}

describe('SemsPlus', () => {
  it('logs in lazily and exposes the region', async () => {
    const { client, http } = sems(() => ok({ dataList: [], total: 0 }));
    expect(client.region).toBeNull();
    await client.stations.list();
    expect(http.requests.filter(isLogin)).toHaveLength(1);
    expect(client.region).toBe('hk');
  });

  it('pages through stations', async () => {
    const pages = [
      { dataList: [{ id: 's1', name: 'One' }, { name: 'no id' }], total: 2 },
      { dataList: [{ id: 's2', name: 'Two' }], total: 2 },
    ];
    const { client, http } = sems((request) => ok(pages[(request.body as { current: number }).current - 1]));
    const stations = await client.stations.list();
    expect(stations.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(http.requests.filter((r) => !isLogin(r)).map((r) => (r.body as { current: number }).current)).toEqual([
      1, 2,
    ]);
  });

  it('requests a power curve the way the portal does', async () => {
    const { client, http } = sems(() => json(curveFixture));
    const curve = await client.power.curve('station-1', '2026-10-22', { timeZone: -8 });
    const request = http.requests.at(-1);
    expect(request?.url).toBe(`${HK_API}/sems-plant/api/v1/hems/power/statisticsAndPreV2`);
    expect(request?.body).toEqual({
      stationId: 'station-1',
      items: ['pSystem', 'pConsum', 'pBat', 'pGrid', 'soc'],
      timeScale: 1,
      timeZone: -8,
      startTime: '2026-10-22 00:00:00',
      endTime: '2026-10-22 23:59:59',
    });
    expect(curve.samples).toHaveLength(3);
  });

  it('requests statistics the way the portal does', async () => {
    const { client, http } = sems(() => ok({ dataList: [] }));
    await client.statistics.get('station-1', { dimension: 'month', from: '2026-06-19', to: '2026-10-23' });
    expect(http.requests.at(-1)?.body).toMatchObject({
      stationId: 'station-1',
      isReport: false,
      dimension: 'month',
      startTime: '2026-06-19 00:00:00',
      endTime: '2026-10-23 23:59:59',
    });
  });

  it('rejects malformed dates before sending anything', async () => {
    const { client, http } = sems(() => ok(null));
    await expect(client.power.curve('s', '2026-02-30')).rejects.toBeInstanceOf(RangeError);
    await expect(client.statistics.get('s', { dimension: 'day', from: '22/10/2026', to: '2026-10-22' })).rejects.toThrow(
      'from must be a date',
    );
    expect(http.requests).toHaveLength(0);
  });

  it('addresses device panels by serial and type', async () => {
    const { client, http } = sems(() => ok([]));
    await client.devices.telemetry('station-1', { sn: 'INV1', deviceType: 'INVERTER' });
    const request = http.requests.at(-1);
    expect(request?.url).toBe(`${HK_API}/sems-plant/api/equipments/INV1/telemetry`);
    expect(request?.query).toEqual({ deviceType: 'INVERTER', pwId: 'station-1' });
  });
});
