import type { Authenticator, Session } from '../auth/authenticator.js';
import type { HttpClient } from '../http/http-client.js';
import { errorFor, isSessionExpired, readEnvelope } from './envelope.js';
import { type Logger, silentLogger } from './logger.js';

export interface ApiRequest {
  method: 'GET' | 'POST';
  /** Path below the account's regional gateway, e.g. `/sems-plant/api/stations/flow`. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

/** Calls an authenticated endpoint and returns the envelope's `data`. */
export interface Requester {
  request(request: ApiRequest): Promise<unknown>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

/**
 * The request pipeline: session → signed headers → send → unwrap the envelope.
 *
 * A session SEMS+ no longer accepts is replaced and the request retried once.
 */
export class ApiClient implements Requester {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: Authenticator,
    private readonly logger: Logger = silentLogger,
  ) {}

  async request(request: ApiRequest): Promise<unknown> {
    let rejected: Session | undefined;
    for (let attempt = 0; ; attempt++) {
      const session = await this.auth.session({ rejected });
      const url = session.api + request.path;
      const response = await this.http.send({
        method: request.method,
        url,
        headers: { ...JSON_HEADERS, ...this.auth.headers(session) },
        query: request.query,
        body: request.body,
      });
      const envelope = readEnvelope(response, url);
      if (envelope.ok) return envelope.data;
      if (isSessionExpired(envelope) && attempt === 0) {
        this.logger.debug(`SEMS+ session expired (code ${envelope.code}); logging in again`);
        rejected = session;
        continue;
      }
      throw errorFor(envelope);
    }
  }
}
