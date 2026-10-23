import { describe, expect, it } from 'vitest';
import { FALLBACK_API_BASE, LOGIN_URL, type Session, SemsPlusWebAuth } from '../../src/auth/authenticator.js';
import { hashPassword, signature } from '../../src/auth/signing.js';
import { MemoryTokenStore } from '../../src/auth/token-store.js';
import { SemsPlusApiError, SemsPlusAuthError, SemsPlusConnectionError } from '../../src/core/errors.js';
import { FakeHttp, HK_API, LOGIN_DATA, json, loginOk } from '../helpers/fake-http.js';

const NOW = 1761200000000;

function auth(http: FakeHttp, store = new MemoryTokenStore()) {
  return new SemsPlusWebAuth({ account: 'me@example.com', password: 'hunter2', http, store, now: () => NOW });
}

describe('SemsPlusWebAuth', () => {
  it('logs in the way the portal does', async () => {
    const http = new FakeHttp(() => loginOk());
    const session = await auth(http).session();

    const [request] = http.requests;
    expect(request?.url).toBe(LOGIN_URL);
    expect(request?.method).toBe('POST');
    expect(request?.body).toEqual({
      account: 'me@example.com',
      pwd: hashPassword('hunter2'),
      agreement: 1,
      isChinese: false,
      isLocal: false,
    });
    expect(request?.headers['X-Signature']).toBe(signature('', '', NOW));
    expect(JSON.parse(request?.headers.Token ?? '')).toMatchObject({ client: 'semsPlusWeb', token: '' });
    expect(session).toEqual({ api: HK_API, token: 'tok-1', uid: 'u-1', region: 'hk', payload: LOGIN_DATA });
  });

  it('falls back to the default gateway when the login names none', async () => {
    const http = new FakeHttp(() => json({ code: '0', data: { token: 't', uid: 'u' } }));
    expect((await auth(http).session()).api).toBe(FALLBACK_API_BASE);
  });

  it('takes the gateway from data.api when the top level has none', async () => {
    const http = new FakeHttp(() => json({ code: '0', data: { token: 't', api: 'https://x/web/sems' } }));
    expect((await auth(http).session()).api).toBe('https://x/web/sems');
  });

  it('signs requests with the session and echoes the login payload', async () => {
    const http = new FakeHttp(() => loginOk());
    const a = auth(http);
    const headers = a.headers(await a.session());
    expect(headers['X-Signature']).toBe(signature('u-1', 'tok-1', NOW));
    expect(JSON.parse(headers.token ?? '')).toEqual({ ...LOGIN_DATA, api: HK_API });
  });

  it('reuses the session until it is rejected', async () => {
    const http = new FakeHttp(() => loginOk());
    const a = auth(http);
    const first = await a.session();
    expect(await a.session()).toBe(first);
    expect(http.requests).toHaveLength(1);
    await a.session({ rejected: first });
    expect(http.requests).toHaveLength(2);
  });

  it('shares one login between concurrent callers', async () => {
    const http = new FakeHttp(() => loginOk());
    const a = auth(http);
    const sessions = await Promise.all([a.session(), a.session(), a.session()]);
    expect(http.requests).toHaveLength(1);
    expect(new Set(sessions).size).toBe(1);
  });

  it('shares one re-login between callers rejecting the same session', async () => {
    const http = new FakeHttp(() => loginOk());
    const a = auth(http);
    const stale = await a.session();
    await Promise.all([a.session({ rejected: stale }), a.session({ rejected: stale })]);
    expect(http.requests).toHaveLength(2);
  });

  it('restores a stored session instead of logging in, and saves new ones', async () => {
    const stored: Session = { api: HK_API, token: 'old', uid: 'u', region: null, payload: { token: 'old' } };
    const store = new MemoryTokenStore();
    await store.save(stored);
    const http = new FakeHttp(() => loginOk());
    const a = auth(http, store);

    expect(await a.session()).toEqual(stored);
    expect(http.requests).toHaveLength(0);

    const renewed = await a.session({ rejected: stored });
    expect(await store.load()).toEqual(renewed);
  });

  it('rejects bad credentials with SemsPlusAuthError', async () => {
    const http = new FakeHttp(() => json({ code: '100001', msg: 'bad password' }));
    await expect(auth(http).session()).rejects.toBeInstanceOf(SemsPlusAuthError);
  });

  it('treats C0602 at login as transient, not as bad credentials', async () => {
    const http = new FakeHttp(() => json({ code: 'C0602' }));
    const error = await auth(http).session().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SemsPlusApiError);
    expect(error).not.toBeInstanceOf(SemsPlusAuthError);
  });

  it('fails when the login succeeds without a token', async () => {
    const http = new FakeHttp(() => json({ code: '0', data: { uid: 'u' } }));
    await expect(auth(http).session()).rejects.toBeInstanceOf(SemsPlusConnectionError);
  });

  it('can log in again after a failed login', async () => {
    let calls = 0;
    const http = new FakeHttp(() => (calls++ === 0 ? json({ code: 'C0602' }) : loginOk()));
    const a = auth(http);
    await expect(a.session()).rejects.toThrow();
    await expect(a.session()).resolves.toMatchObject({ token: 'tok-1' });
  });
});
