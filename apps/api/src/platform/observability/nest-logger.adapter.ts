import { Injectable, Logger } from '@nestjs/common';
import { ILogger } from '../../shared/kernel/logger.port';

@Injectable()
export class NestLoggerAdapter implements ILogger {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  log(obj: object | string, context?: string): void {
    this.logger.log(obj, context);
  }

  warn(obj: object | string, context?: string): void {
    this.logger.warn(obj, context);
  }

  error(obj: object | string, context?: string): void {
    this.logger.error(obj, context);
  }
}
