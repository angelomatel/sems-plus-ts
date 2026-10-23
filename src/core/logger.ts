/** Where the client reports what it is doing. `console` satisfies it. */
export interface Logger {
  debug(message: string): void;
}

export const silentLogger: Logger = { debug() {} };
