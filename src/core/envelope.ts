import {
  type SemsPlusError,
  SemsPlusApiError,
  SemsPlusConnectionError,
  SemsPlusPermissionError,
} from './errors.js';
import { type JsonRecord, isRecord } from './json.js';
import type { HttpResponse } from '../http/http-client.js';

const SUCCESS_CODES = new Set(['0', '00000']);
const PERMISSION_CODE = '100025';
/** A token the server no longer accepts (expired, or replaced by another login). */
const SESSION_EXPIRED_CODES = new Set(['100002', 'C0602']);

/** The `{code, data, msg}` wrapper every SEMS+ response comes in. */
export interface Envelope {
  code: string;
  ok: boolean;
  data: unknown;
  message: string;
  raw: JsonRecord;
}

export function readEnvelope(response: HttpResponse, url: string): Envelope {
  if (response.status >= 400) {
    throw new SemsPlusConnectionError(`SEMS+ returned HTTP ${response.status} for ${url}`);
  }
  const body = response.body;
  if (!isRecord(body)) {
    throw new SemsPlusConnectionError(`SEMS+ returned an unexpected payload for ${url}`);
  }
  const code = String(body.code);
  return { code, ok: SUCCESS_CODES.has(code), data: body.data, message: messageOf(body), raw: body };
}

export function isSessionExpired(envelope: Envelope): boolean {
  return SESSION_EXPIRED_CODES.has(envelope.code);
}

export function errorFor(envelope: Envelope): SemsPlusError {
  if (envelope.code === PERMISSION_CODE) return new SemsPlusPermissionError(envelope.message);
  return new SemsPlusApiError(envelope.code, envelope.message);
}

function messageOf(body: JsonRecord): string {
  for (const key of ['msg', 'description', 'errorMsg']) {
    const value = body[key];
    if (typeof value === 'string' && value) return value;
  }
  return 'SEMS+ request failed';
}
