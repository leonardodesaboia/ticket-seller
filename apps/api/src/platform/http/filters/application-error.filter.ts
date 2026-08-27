import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApplicationError, UnprocessableError } from '../../../shared/kernel/application-errors';

@Catch(ApplicationError)
export class ApplicationErrorFilter implements ExceptionFilter {
  catch(exception: ApplicationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.statusHint;

    const problem: Record<string, unknown> = {
      type: `https://httpstatuses.com/${status}`,
      title: exception.name,
      status,
      detail: exception.message,
      instance: request.url,
    };

    if (exception instanceof UnprocessableError && exception.code !== undefined) {
      problem['code'] = exception.code;
    }

    reply.status(status).type('application/problem+json').send(problem);
  }
}
