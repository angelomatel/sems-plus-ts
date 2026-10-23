/** Base class for every error this package raises. */
export class SemsPlusError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** SEMS+ could not be reached, or answered with something unreadable. */
export class SemsPlusConnectionError extends SemsPlusError {}

/** SEMS+ rejected the account's credentials. */
export class SemsPlusAuthError extends SemsPlusError {}

/** The account may not read this station or device. */
export class SemsPlusPermissionError extends SemsPlusError {}

/** SEMS+ answered with an error code. */
export class SemsPlusApiError extends SemsPlusError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${message} (code ${code})`);
  }
}

/** SEMS+ asked us to slow down; no request is sent until the pause ends. */
export class SemsPlusRateLimitError extends SemsPlusError {
  constructor(readonly retryAfterSeconds: number) {
    super(`SEMS+ rate limited; retry after ${retryAfterSeconds}s`);
  }
}
