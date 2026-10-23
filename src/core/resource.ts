import type { Requester } from './api-client.js';

/** Base for the resource namespaces (`sems.stations`, `sems.power`, ...). */
export abstract class ApiResource {
  constructor(protected readonly requester: Requester) {}
}
