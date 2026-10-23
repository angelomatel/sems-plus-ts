export { SemsPlus, type SemsPlusOptions } from './client.js';

export type { Stations } from './resources/stations.js';
export type { Devices, DeviceRef } from './resources/devices.js';
export type { Statistics, StatisticsQuery } from './resources/statistics.js';
export type { Power, PowerCurveOptions } from './resources/power.js';
export type { Alarms } from './resources/alarms.js';

export type * from './types/domain.js';

export {
  SemsPlusError,
  SemsPlusApiError,
  SemsPlusAuthError,
  SemsPlusConnectionError,
  SemsPlusPermissionError,
  SemsPlusRateLimitError,
} from './core/errors.js';

export type { Logger } from './core/logger.js';
export {
  FetchHttpClient,
  type FetchHttpClientOptions,
  type HttpClient,
  type HttpRequest,
  type HttpResponse,
} from './http/http-client.js';
export { MemoryTokenStore, type TokenStore } from './auth/token-store.js';
export {
  SemsPlusWebAuth,
  type Authenticator,
  type Session,
  type SemsPlusWebAuthOptions,
} from './auth/authenticator.js';
