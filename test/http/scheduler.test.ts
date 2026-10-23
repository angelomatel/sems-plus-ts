import { describe, expect, it } from 'vitest';
import { SemsPlusRateLimitError } from '../../src/core/errors.js';
import type { HttpRequest } from '../../src/http/http-client.js';
import { RequestScheduler } from '../../src/http/scheduler.js';
import { FakeHttp, json, ok } from '../helpers/fake-http.js';

const REQUEST: HttpRequest = { method: 'GET', url: 'https://example.test/x', headers: {} };

/** A clock that only moves when the scheduler sleeps or a test advances it. */
function fakeClock() {
  const clock = {
    time: 1_000,
    sleeps: [] as number[],
    now: () => clock.time,
    sleep: async (ms: number) => {
      clock.sleeps.push(ms);
      clock.time += ms;
    },
  };
  return clock;
}

describe('RequestScheduler', () => {
  it('sends requests one at a time, in order', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];
    const inner = new FakeHttp(async (request) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(request.url);
      inFlight--;
      return ok(null);
    });
    const scheduler = new RequestScheduler(inner, { spacingMs: 0 });
    await Promise.all(['a', 'b', 'c'].map((p) => scheduler.send({ ...REQUEST, url: `https://e.test/${p}` })));
    expect(maxInFlight).toBe(1);
    expect(order).toEqual(['https://e.test/a', 'https://e.test/b', 'https://e.test/c']);
  });

  it('spaces requests apart', async () => {
    const clock = fakeClock();
    const scheduler = new RequestScheduler(new FakeHttp(() => ok(null)), { spacingMs: 100, ...clock });
    await scheduler.send(REQUEST);
    await scheduler.send(REQUEST);
    expect(clock.sleeps).toEqual([100]);
  });

  it('keeps going after a failed request', async () => {
    let calls = 0;
    const inner = new FakeHttp(() => {
      if (calls++ === 0) throw new Error('boom');
      return ok('second');
    });
    const scheduler = new RequestScheduler(inner, { spacingMs: 0 });
    const results = await Promise.allSettled([scheduler.send(REQUEST), scheduler.send(REQUEST)]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
  });

  it('pauses on HTTP 429 for Retry-After seconds', async () => {
    const clock = fakeClock();
    const inner = new FakeHttp(() => json(undefined, 429, { 'Retry-After': '42' }));
    const scheduler = new RequestScheduler(inner, { spacingMs: 0, ...clock });

    const error = await scheduler.send(REQUEST).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SemsPlusRateLimitError);
    expect((error as SemsPlusRateLimitError).retryAfterSeconds).toBe(42);

    clock.time += 10_000;
    await expect(scheduler.send(REQUEST)).rejects.toMatchObject({ retryAfterSeconds: 33 });
    expect(inner.requests).toHaveLength(1);

    clock.time += 33_000;
    await scheduler.send(REQUEST).catch(() => undefined);
    expect(inner.requests).toHaveLength(2);
  });

  it('clamps Retry-After and defaults it to 300 s', async () => {
    for (const [header, expected] of [
      ['99999', 3600],
      ['0', 1],
      ['soon', 300],
    ] as const) {
      const inner = new FakeHttp(() => json(undefined, 429, { 'Retry-After': header }));
      const scheduler = new RequestScheduler(inner, { spacingMs: 0, ...fakeClock() });
      await expect(scheduler.send(REQUEST)).rejects.toMatchObject({ retryAfterSeconds: expected });
    }
  });

  it('pauses for 300 s on envelope code GY0429', async () => {
    const inner = new FakeHttp(() => json({ code: 'GY0429' }));
    const scheduler = new RequestScheduler(inner, { spacingMs: 0, ...fakeClock() });
    await expect(scheduler.send(REQUEST)).rejects.toMatchObject({ retryAfterSeconds: 300 });
    await expect(scheduler.send(REQUEST)).rejects.toBeInstanceOf(SemsPlusRateLimitError);
    expect(inner.requests).toHaveLength(1);
  });
});
