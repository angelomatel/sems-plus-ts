import { SemsPlusRateLimitError } from '../core/errors.js';
import { isRecord } from '../core/json.js';
import type { HttpClient, HttpRequest, HttpResponse } from './http-client.js';

/** The envelope code SEMS+ uses for "too many requests" on an HTTP 200. */
const RATE_LIMIT_CODE = 'GY0429';
const DEFAULT_PAUSE_SECONDS = 300;
const MAX_RETRY_AFTER_SECONDS = 3_600;

export interface RequestSchedulerOptions {
  /** Minimum gap between one request finishing and the next starting. */
  spacingMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Wraps an `HttpClient` so requests go out one at a time, spaced apart, and
 * stop entirely while SEMS+ has asked for a pause.
 *
 * Every rate-limit signal (HTTP 429, or code GY0429 in the body) is handled
 * here, so the layers above never see one as anything but an error.
 */
export class RequestScheduler implements HttpClient {
  private readonly spacingMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private lastFinished = Number.NEGATIVE_INFINITY;
  private pausedUntil = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly inner: HttpClient,
    options: RequestSchedulerOptions = {},
  ) {
    this.spacingMs = options.spacingMs ?? 100;
    this.now = options.now ?? (() => performance.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  send(request: HttpRequest): Promise<HttpResponse> {
    const run = () => this.dispatch(request);
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private async dispatch(request: HttpRequest): Promise<HttpResponse> {
    this.throwIfPaused();
    const wait = this.lastFinished + this.spacingMs - this.now();
    if (wait > 0) await this.sleep(wait);
    let response: HttpResponse;
    try {
      response = await this.inner.send(request);
    } finally {
      this.lastFinished = this.now();
    }
    if (response.status === 429) {
      throw this.pause(retryAfterSeconds(response.headers.get('retry-after')));
    }
    if (isRecord(response.body) && String(response.body.code) === RATE_LIMIT_CODE) {
      throw this.pause(DEFAULT_PAUSE_SECONDS);
    }
    return response;
  }

  private pause(seconds: number): SemsPlusRateLimitError {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + seconds * 1000);
    return new SemsPlusRateLimitError(seconds);
  }

  private throwIfPaused(): void {
    const remainingMs = this.pausedUntil - this.now();
    if (remainingMs > 0) throw new SemsPlusRateLimitError(Math.floor(remainingMs / 1000) + 1);
  }
}

function retryAfterSeconds(header: string | null): number {
  const seconds = header === null ? NaN : Number.parseInt(header, 10);
  if (Number.isNaN(seconds)) return DEFAULT_PAUSE_SECONDS;
  return Math.min(Math.max(seconds, 1), MAX_RETRY_AFTER_SECONDS);
}
