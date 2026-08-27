export const LOGGER = Symbol('ILogger');

export interface ILogger {
  log(obj: object | string, context?: string): void;
  warn(obj: object | string, context?: string): void;
  error(obj: object | string, context?: string): void;
}
