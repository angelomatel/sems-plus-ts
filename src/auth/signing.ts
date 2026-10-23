import { createHash } from 'node:crypto';

/** The password as the SEMS+ web login sends it: base64 of its MD5 hex digest. */
export function hashPassword(password: string): string {
  const hex = createHash('md5').update(password, 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

/** The `X-Signature` header: base64 of `sha256hex("{ms}@{uid}@{token}")@{ms}`. */
export function signature(uid: string, token: string, epochMs: number): string {
  const digest = createHash('sha256').update(`${epochMs}@${uid}@${token}`, 'utf8').digest('hex');
  return Buffer.from(`${digest}@${epochMs}`, 'utf8').toString('base64');
}
