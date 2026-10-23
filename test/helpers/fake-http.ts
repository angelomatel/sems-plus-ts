import type { HttpClient, HttpRequest, HttpResponse } from '../../src/http/http-client.js';

export type Responder = (request: HttpRequest) => HttpResponse | Promise<HttpResponse>;

/** An `HttpClient` that records requests and answers them with `responder`. */
export class FakeHttp implements HttpClient {
  readonly requests: HttpRequest[] = [];

  constructor(private readonly responder: Responder) {}

  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    return this.responder(request);
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): HttpResponse {
  return { status, headers: new Headers(headers), body };
}

export function ok(data: unknown): HttpResponse {
  return json({ code: '00000', data });
}

export const LOGIN_DATA = {
  uid: 'u-1',
  token: 'tok-1',
  region: 'hk',
  timestamp: 1761200000000,
  client: 'semsPlusWeb',
};

export const HK_API = 'https://hk-gateway.semsportal.com/web/sems';

/** A login answer naming the HK gateway, as the real one does. */
export function loginOk(data: Record<string, unknown> = LOGIN_DATA): HttpResponse {
  return json({ code: '0', data, api: HK_API });
}

export function isLogin(request: HttpRequest): boolean {
  return request.url.endsWith('/auth/cross-login');
}
