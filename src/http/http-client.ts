import { SemsPlusConnectionError } from '../core/errors.js';

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
  /** Sent as JSON. Omit for no body. */
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  headers: { get(name: string): string | null };
  /** The parsed JSON body; undefined when the body is empty. */
  body: unknown;
}

/** Sends one HTTP request. The seam for swapping or faking the transport. */
export interface HttpClient {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export interface FetchHttpClientOptions {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** An `HttpClient` over the Fetch API. Every status is returned, not thrown. */
export class FetchHttpClient implements HttpClient {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: FetchHttpClientOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async send(request: HttpRequest): Promise<HttpResponse> {
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(key, value);
    }
    let response: Response;
    let text: string;
    try {
      response = await this.fetch(url, {
        method: request.method,
        headers: request.headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      text = await response.text();
    } catch (error) {
      throw new SemsPlusConnectionError(`SEMS+ request to ${url.pathname} failed: ${String(error)}`, {
        cause: error,
      });
    }
    return { status: response.status, headers: response.headers, body: parseBody(text, response.status) };
  }
}

function parseBody(text: string, status: number): unknown {
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch (error) {
    // Error pages are often HTML; the status alone tells the caller enough.
    if (status >= 400) return undefined;
    throw new SemsPlusConnectionError('SEMS+ returned a body that is not JSON', { cause: error });
  }
}
