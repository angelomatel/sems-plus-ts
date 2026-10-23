# sems-plus-ts

Unofficial, **read-only** TypeScript client for the [GoodWe SEMS+](https://semsplus.goodwe.com) cloud — the
portal behind GoodWe hybrid inverters, batteries and smart meters.

- Station list, live power flow, devices, telemetry and alarms
- Daily / monthly / yearly energy statistics (PV, consumption, import, export, battery)
- **One-minute power curves** for any past day (PV, load, battery, grid, SOC)
- Zero runtime dependencies; Node 22+, ESM, fully typed

> Not affiliated with or endorsed by GoodWe. It talks to the same undocumented API the SEMS+ web portal
> uses, which can change without notice. It never writes to your devices.

## Install

```sh
npm install sems-plus-ts
```

## Usage

```ts
import { SemsPlus } from 'sems-plus-ts';

const sems = new SemsPlus({ account: 'you@example.com', password: process.env.SEMS_PASSWORD! });

const [station] = await sems.stations.list();

// One sample per minute, in kW (soc in %)
const curve = await sems.power.curve(station.id, '2026-10-22', { timeZone: -8 });
for (const { time, pv, load, battery, grid, soc } of curve.samples) {
  // ...
}

// One row per day, in kWh
const { periods } = await sems.statistics.get(station.id, {
  dimension: 'day',
  from: '2026-10-01',
  to: '2026-10-22',
});

const flow = await sems.stations.powerFlow(station.id); // live, kW
```

### Resources

| Namespace         | Methods                                                         |
| ----------------- | --------------------------------------------------------------- |
| `sems.stations`   | `list()`, `info(id)`, `powerFlow(id)`                            |
| `sems.devices`    | `list(id)`, `details(id)`, `information`, `telemetry`, `counters` |
| `sems.statistics` | `get(id, { dimension, from, to })`                              |
| `sems.power`      | `curve(id, date, { timeZone? })`                                |
| `sems.alarms`     | `counts(id)`, `list(id, { pageSize? })`                         |

### Conventions

- **Signs:** `battery` is positive while discharging, `grid` is positive while **importing**, `load` is always
  a magnitude. (SEMS+ itself reports grid positive while exporting; this package flips it everywhere.)
- **Times** in power curves are the station's local time, `YYYY-MM-DD HH:mm:ss`, exactly as SEMS+ sends them.
- **Missing values** are `null`, never `0`.
- **Statistics** ranges must stay within one calendar year (SEMS+ returns zeros otherwise), and nothing exists
  before the station's `info().created` day.
- **`timeZone`** for power curves is the station's UTC offset with the sign flipped, like
  `Date#getTimezoneOffset() / 60` (UTC+8 → `-8`). It defaults to the machine's offset, as the portal does —
  set it explicitly when your code runs in a different zone from the station.

### Errors

Every error extends `SemsPlusError`:

| Class                     | When                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `SemsPlusAuthError`       | Wrong account or password                                     |
| `SemsPlusPermissionError` | The account may not read that station or device               |
| `SemsPlusRateLimitError`  | SEMS+ asked for a pause; `retryAfterSeconds` says how long     |
| `SemsPlusApiError`        | Any other SEMS+ error code (`code`)                            |
| `SemsPlusConnectionError` | Network failure, HTTP error, or an unreadable response         |

Expired sessions are renewed automatically (one re-login, one retry).

## Being a good citizen

Requests from one `SemsPlus` instance are sent one at a time and spaced apart (100 ms by default), and the
client stops sending entirely while SEMS+ has asked for a pause. Use **one instance per account**, and poll
rarely — SEMS+ already aggregates history, so a few requests a day are plenty.

## Customising

Every moving part sits behind a small interface, passed to the constructor:

```ts
new SemsPlus({
  account,
  password,
  tokenStore: myFileTokenStore, // TokenStore: reuse a session across process runs (e.g. cron jobs)
  http: myHttpClient, // HttpClient: swap or wrap the transport (proxy, logging, tests)
  logger: console, // Logger: debug messages
  requestSpacingMs: 250,
});
```

```ts
import { readFile, writeFile, rm } from 'node:fs/promises';
import type { Session, TokenStore } from 'sems-plus-ts';

class FileTokenStore implements TokenStore {
  constructor(private path: string) {}
  async load() {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as Session;
    } catch {
      return null;
    }
  }
  async save(session: Session) {
    await writeFile(this.path, JSON.stringify(session), { mode: 0o600 });
  }
  async clear() {
    await rm(this.path, { force: true });
  }
}
```

## Architecture

A resource-oriented SDK in the style of the Stripe and OpenAI clients: `SemsPlus` is the facade and
composition root; resources (`stations`, `power`, ...) are thin and call one request pipeline; transport,
scheduling and authentication sit behind interfaces.

```
src/
├── client.ts          SemsPlus facade: wires defaults, mounts resources
├── core/              request pipeline, envelope + error mapping, pagination, JSON readers
├── auth/              SEMS+ web login, request signing, token stores
├── http/              HttpClient + fetch adapter, RequestScheduler (queue, spacing, rate limits)
├── resources/         stations, devices, statistics, power, alarms
├── mappers/           pure raw → domain functions (sign conventions live here)
└── types/             raw (wire) and domain (public) models
```

## Development

```sh
npm install
npm run typecheck && npm test
npm run build
cp .env.example .env   # then fill it in
npm run smoke          # live check against your own account
```

## Credits

The SEMS+ login, request signing and most endpoint knowledge are ported from
[haids3/sems-plus-client](https://github.com/haids3/sems-plus-client) (MIT), which credits the login scheme to
[TimSoethout/goodwe-sems-home-assistant](https://github.com/TimSoethout/goodwe-sems-home-assistant). The
one-minute power-curve endpoint was mapped from the SEMS+ web portal.

## License

MIT
