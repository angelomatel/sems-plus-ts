// Keeps the README's FileTokenStore example compiling and working.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SemsPlus, type Session, type TokenStore } from '../src/index.js';
import { FakeHttp, isLogin, loginOk, ok } from './helpers/fake-http.js';

class FileTokenStore implements TokenStore {
  constructor(private path: string) {}
  async load() {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as Session;
    } catch {
      return null;
    }
  }
  async save(session: Session) {
    await writeFile(this.path, JSON.stringify(session), { mode: 0o600 });
  }
  async clear() {
    await rm(this.path, { force: true });
  }
}

describe('README FileTokenStore example', () => {
  it('lets a second process reuse the first one’s login', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sems-plus-'));
    try {
      const path = join(dir, 'session.json');
      const run = async () => {
        const http = new FakeHttp((r) => (isLogin(r) ? loginOk() : ok({ dataList: [], total: 0 })));
        await new SemsPlus({ account: 'a', password: 'p', http, tokenStore: new FileTokenStore(path) }).stations.list();
        return http.requests.filter(isLogin).length;
      };
      expect(await run()).toBe(1);
      expect(await run()).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
