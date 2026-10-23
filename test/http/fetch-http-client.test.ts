import { describe, expect, it } from 'vitest';
import { SemsPlusConnectionError } from '../../src/core/errors.js';
import { FetchHttpClient } from '../../src/http/http-client.js';

function fakeFetch(respond: () => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}

describe('FetchHttpClient', () => {
  it('adds the query, JSON-encodes the body and parses the response', async () => {
    const { fn, calls } = fakeFetch(() => new Response('{"code":"0","data":1}'));
    const client = new FetchHttpClient({ fetch: fn });
    const response = await client.send({
      method: 'POST',
      url: 'https://e.test/a',
      headers: { X: '1' },
      query: { stationId: 'abc def' },
      body: { n: 1 },
    });
    expect(calls[0]?.url).toBe('https://e.test/a?stationId=abc+def');
    expect(calls[0]?.init?.body).toBe('{"n":1}');
    expect(calls[0]?.init?.headers).toEqual({ X: '1' });
    expect(response).toMatchObject({ status: 200, body: { code: '0', data: 1 } });
  });

  it('sends no body when none is given', async () => {
    const { fn, calls } = fakeFetch(() => new Response(''));
    const response = await new FetchHttpClient({ fetch: fn }).send({ method: 'GET', url: 'https://e.test', headers: {} });
    expect(calls[0]?.init?.body).toBeUndefined();
    expect(response.body).toBeUndefined();
  });

  it('returns error statuses instead of throwing, even with an HTML body', async () => {
    const { fn } = fakeFetch(() => new Response('<html>busy</html>', { status: 503 }));
    const response = await new FetchHttpClient({ fetch: fn }).send({ method: 'GET', url: 'https://e.test', headers: {} });
    expect(response).toMatchObject({ status: 503, body: undefined });
  });

  it('rejects a 200 whose body is not JSON', async () => {
    const { fn } = fakeFetch(() => new Response('not json'));
    await expect(
      new FetchHttpClient({ fetch: fn }).send({ method: 'GET', url: 'https://e.test', headers: {} }),
    ).rejects.toBeInstanceOf(SemsPlusConnectionError);
  });

  it('wraps network failures', async () => {
    const fn = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const error = await new FetchHttpClient({ fetch: fn })
      .send({ method: 'GET', url: 'https://e.test/p', headers: {} })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SemsPlusConnectionError);
    expect((error as Error).cause).toBeInstanceOf(TypeError);
  });
});
