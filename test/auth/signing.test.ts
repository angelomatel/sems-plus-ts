import { describe, expect, it } from 'vitest';
import { hashPassword, signature } from '../../src/auth/signing.js';

// Expected values computed with the reference Python implementation
// (haids3/sems-plus-client `_hash_password` / `_signature`).
describe('hashPassword', () => {
  it('matches the reference for ASCII', () => {
    expect(hashPassword('hunter2')).toBe('MmFiOTYzOTBjN2RiZTM0MzlkZTc0ZDBjOWIwYjE3Njc=');
  });

  it('matches the reference for non-ASCII (UTF-8)', () => {
    expect(hashPassword('pässwörd-日本')).toBe('YWQ3MTQwNjI5YWMwYTViNTNkMGQwMDM2N2E3MDUzNDI=');
  });
});

describe('signature', () => {
  it('matches the reference for the anonymous login signature', () => {
    expect(signature('', '', 1761200000000)).toBe(
      'MzBmY2JiMGFhZDIwOGVjMDRiYTg5NTI4YWI2NDlmMmIxZjdmODg5YWU3ZDNiYWU1OWY5ZmM0NDVkYzJkZDBhN0AxNzYxMjAwMDAwMDAw',
    );
  });

  it('matches the reference for a session signature', () => {
    expect(signature('u-123', 'tok-abc', 1761200000123)).toBe(
      'MGUwMTEyODk5NjdiZjU1NGQ3ZmU4YjI4N2U2MmRkNDhiM2QyNGUyNmQyMDk1NTNlNWZlNGZlOGUwNTY2OTQ1MEAxNzYxMjAwMDAwMTIz',
    );
  });
});
