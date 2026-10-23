import { type Session, SemsPlusWebAuth } from './auth/authenticator.js';
import type { TokenStore } from './auth/token-store.js';
import { ApiClient } from './core/api-client.js';
import type { Logger } from './core/logger.js';
import { FetchHttpClient, type HttpClient } from './http/http-client.js';
import { RequestScheduler } from './http/scheduler.js';
import { Alarms } from './resources/alarms.js';
import { Devices } from './resources/devices.js';
import { Power } from './resources/power.js';
import { Stations } from './resources/stations.js';
import { Statistics } from './resources/statistics.js';

export interface SemsPlusOptions {
  /** The SEMS+ account e-mail. */
  account: string;
  password: string;
  /** Where the session is kept between runs. Defaults to memory. */
  tokenStore?: TokenStore;
  /** The transport. Defaults to `fetch`; every request is still scheduled. */
  http?: HttpClient;
  /** Only used by the default transport. */
  fetch?: typeof fetch;
  /** Only used by the default transport. Defaults to 30 s. */
  timeoutMs?: number;
  /** Minimum gap between requests. Defaults to 100 ms. */
  requestSpacingMs?: number;
  logger?: Logger;
}

/**
 * One SEMS+ account.
 *
 * Requests are serialised and spaced, so share one instance across every
 * station of the account rather than creating one per station.
 */
export class SemsPlus {
  readonly stations: Stations;
  readonly devices: Devices;
  readonly statistics: Statistics;
  readonly power: Power;
  readonly alarms: Alarms;
  private readonly auth: SemsPlusWebAuth;

  constructor(options: SemsPlusOptions) {
    const transport =
      options.http ?? new FetchHttpClient({ fetch: options.fetch, timeoutMs: options.timeoutMs });
    const http = new RequestScheduler(transport, { spacingMs: options.requestSpacingMs });
    this.auth = new SemsPlusWebAuth({
      account: options.account,
      password: options.password,
      http,
      store: options.tokenStore,
      logger: options.logger,
    });
    const api = new ApiClient(http, this.auth, options.logger);
    this.stations = new Stations(api);
    this.devices = new Devices(api);
    this.statistics = new Statistics(api);
    this.power = new Power(api);
    this.alarms = new Alarms(api);
  }

  /** Log in now instead of on the first request; surfaces bad credentials early. */
  login(): Promise<Session> {
    return this.auth.login();
  }

  /** The account's region ("hk", "eu", ...), once logged in. */
  get region(): string | null {
    return this.auth.currentSession?.region ?? null;
  }
}
