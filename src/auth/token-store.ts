import type { Session } from './authenticator.js';

/**
 * Where a session survives between client instances.
 *
 * Persisting it (a file, a database row) lets a short-lived process such as a
 * cron job reuse the last login instead of signing in on every run.
 */
export interface TokenStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

/** Keeps the session for the lifetime of the process only. */
export class MemoryTokenStore implements TokenStore {
  private session: Session | null = null;

  async load(): Promise<Session | null> {
    return this.session;
  }

  async save(session: Session): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}
