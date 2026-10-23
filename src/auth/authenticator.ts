import { SemsPlusApiError, SemsPlusAuthError, SemsPlusConnectionError } from '../core/errors.js';
import { readEnvelope } from '../core/envelope.js';
import { type JsonRecord, isRecord, toText } from '../core/json.js';
import { type Logger, silentLogger } from '../core/logger.js';
import type { HttpClient } from '../http/http-client.js';
import { hashPassword, signature } from './signing.js';
import { MemoryTokenStore, type TokenStore } from './token-store.js';

/** A logged-in SEMS+ session. Plain data, so a `TokenStore` can serialise it. */
export interface Session {
  /** The account's regional gateway, e.g. `https://hk-gateway.semsportal.com/web/sems`. */
  readonly api: string;
  readonly token: string;
  readonly uid: string;
  /** e.g. "hk", "eu", "au"; null when SEMS+ does not say. */
  readonly region: string | null;
  /** The login `data` as SEMS+ returned it; echoed back in every request's `token` header. */
  readonly payload: Readonly<JsonRecord>;
}

/** Supplies sessions and the headers that authenticate a request with one. */
export interface Authenticator {
  /**
   * The current session, logging in when there is none. Pass the session a
   * request was just refused with to force a new login; concurrent callers
   * passing the same rejected session share one login.
   */
  session(options?: { rejected?: Session }): Promise<Session>;
  headers(session: Session): Record<string, string>;
}

export const LOGIN_URL = 'https://semsplus.goodwe.com/web/sems/sems-user/api/v1/auth/cross-login';
/** Used when a login response does not name the account's regional gateway. */
export const FALLBACK_API_BASE = 'https://eu-gateway.semsportal.com/web/sems';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const LOGIN_TOKEN = JSON.stringify({
  uid: '',
  timestamp: 0,
  token: '',
  client: 'semsPlusWeb',
  version: '',
  language: 'en',
});
/** Login rejections that say nothing about the credentials. */
const TRANSIENT_LOGIN_CODES = new Set(['C0602']);

export interface SemsPlusWebAuthOptions {
  account: string;
  password: string;
  http: HttpClient;
  store?: TokenStore;
  logger?: Logger;
  /** Wall-clock milliseconds, for the request signature. */
  now?: () => number;
}

/** Logs in the way the SEMS+ web portal does (`cross-login`). */
export class SemsPlusWebAuth implements Authenticator {
  private readonly account: string;
  private readonly password: string;
  private readonly http: HttpClient;
  private readonly store: TokenStore;
  private readonly logger: Logger;
  private readonly now: () => number;
  private current: Session | null = null;
  private restoring: Promise<void> | null = null;
  private loggingIn: Promise<Session> | null = null;

  constructor(options: SemsPlusWebAuthOptions) {
    this.account = options.account;
    this.password = options.password;
    this.http = options.http;
    this.store = options.store ?? new MemoryTokenStore();
    this.logger = options.logger ?? silentLogger;
    this.now = options.now ?? Date.now;
  }

  /** The session in use, if any; does not log in. */
  get currentSession(): Session | null {
    return this.current;
  }

  async session(options: { rejected?: Session } = {}): Promise<Session> {
    if (this.current === null && this.loggingIn === null) await this.restore();
    if (this.loggingIn) return this.loggingIn;
    const current = this.current;
    const rejected = options.rejected;
    if (current && !(rejected && current.token === rejected.token)) return current;
    return this.login();
  }

  /** Log in now, replacing any current session. */
  login(): Promise<Session> {
    this.loggingIn ??= this.performLogin().finally(() => {
      this.loggingIn = null;
    });
    return this.loggingIn;
  }

  headers(session: Session): Record<string, string> {
    return {
      'User-Agent': USER_AGENT,
      token: JSON.stringify({ ...session.payload, api: session.api }),
      'X-Signature': signature(session.uid, session.token, this.now()),
    };
  }

  private restore(): Promise<void> {
    this.restoring ??= this.store.load().then((stored) => {
      this.current ??= stored;
    });
    return this.restoring;
  }

  private async performLogin(): Promise<Session> {
    const response = await this.http.send({
      method: 'POST',
      url: LOGIN_URL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://semsplus.goodwe.com',
        Referer: 'https://semsplus.goodwe.com/',
        'User-Agent': USER_AGENT,
        Token: LOGIN_TOKEN,
        'X-Signature': signature('', '', this.now()),
      },
      body: {
        account: this.account,
        pwd: hashPassword(this.password),
        agreement: 1,
        isChinese: false,
        isLocal: false,
      },
    });
    const envelope = readEnvelope(response, LOGIN_URL);
    const data = envelope.data;
    if (!envelope.ok || !isRecord(data)) {
      if (TRANSIENT_LOGIN_CODES.has(envelope.code)) {
        throw new SemsPlusApiError(envelope.code, 'SEMS+ login failed');
      }
      throw new SemsPlusAuthError(`SEMS+ rejected the credentials (code ${envelope.code})`);
    }
    const token = toText(data.token);
    if (token === null) throw new SemsPlusConnectionError('SEMS+ login returned no token');
    const session: Session = {
      api: toText(envelope.raw.api) ?? toText(data.api) ?? FALLBACK_API_BASE,
      token,
      uid: data.uid === undefined || data.uid === null ? '' : String(data.uid),
      region: toText(data.region),
      payload: data,
    };
    this.current = session;
    await this.store.save(session);
    this.logger.debug(`Logged in to SEMS+ via ${session.api}`);
    return session;
  }
}
