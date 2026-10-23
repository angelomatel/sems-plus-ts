import { describe, expect, it } from 'vitest';
import { SemsPlusWebAuth } from '../../src/auth/authenticator.js';
import { ApiClient } from '../../src/core/api-client.js';
import {
  SemsPlusApiError,
  SemsPlusConnectionError,
  SemsPlusPermissionError,
} from '../../src/core/errors.js';
import type { HttpResponse } from '../../src/http/http-client.js';
import { FakeHttp, HK_API, isLogin, json, loginOk, ok } from '../helpers/fake-http.js';

/** An ApiClient whose non-login requests get `answers` in turn. */
function client(...answers: HttpResponse[]) {
  let tokens = 0;
  const http = new FakeHttp((request) => {
    if (isLogin(request)) return loginOk({ uid: 'u', token: `tok-${++tokens}` });
    const answer = answers.shift();
    if (!answer) throw new Error('no more answers');
    return answer;
  });
  const auth = new SemsPlusWebAuth({ account: 'a', password: 'p', http });
  return { api: new ApiClient(http, auth), http };
}

describe('ApiClient', () => {
  it('sends to the regional gateway with JSON and auth headers, returning data', async () => {
    const { api, http } = client(ok({ answer: 42 }));
    const data = await api.request({ method: 'GET', path: '/sems-plant/api/x', query: { a: '1' } });
    expect(data).toEqual({ answer: 42 });
    const request = http.requests[1];
    expect(request?.url).toBe(`${HK_API}/sems-plant/api/x`);
    expect(request?.query).toEqual({ a: '1' });
    expect(request?.headers).toMatchObject({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(request?.headers['X-Signature']).toBeTypeOf('string');
    expect(JSON.parse(request?.headers.token ?? '')).toMatchObject({ token: 'tok-1' });
  });

  it('logs in again and retries once when the session expired', async () => {
    const { api, http } = client(json({ code: '100002' }), ok('fresh'));
    await expect(api.request({ method: 'GET', path: '/p' })).resolves.toBe('fresh');
    const logins = http.requests.filter(isLogin);
    expect(logins).toHaveLength(2);
    expect(JSON.parse(http.requests.at(-1)?.headers.token ?? '')).toMatchObject({ token: 'tok-2' });
  });

  it('gives up when the new session is refused too', async () => {
    const { api } = client(json({ code: 'C0602' }), json({ code: 'C0602', msg: 'nope' }));
    const error = await api.request({ method: 'GET', path: '/p' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SemsPlusApiError);
    expect((error as SemsPlusApiError).code).toBe('C0602');
  });

  it('maps 100025 to SemsPlusPermissionError', async () => {
    const { api } = client(json({ code: '100025', msg: 'no access' }));
    await expect(api.request({ method: 'GET', path: '/p' })).rejects.toBeInstanceOf(SemsPlusPermissionError);
  });

  it('reports other codes with their message', async () => {
    const { api } = client(json({ code: 'X1', description: 'went wrong' }));
    await expect(api.request({ method: 'GET', path: '/p' })).rejects.toThrow('went wrong (code X1)');
  });

  it('treats HTTP errors and non-object bodies as connection errors', async () => {
    for (const answer of [json(undefined, 500), json(['not', 'an', 'envelope'])]) {
      const { api } = client(answer);
      await expect(api.request({ method: 'GET', path: '/p' })).rejects.toBeInstanceOf(SemsPlusConnectionError);
    }
  });
});
