import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let detail: string;
    if (typeof exceptionResponse === 'string') {
      detail = exceptionResponse;
    } else {
      const msg = (exceptionResponse as Record<string, unknown>)['message'];
      detail = Array.isArray(msg) ? msg.join(', ') : String(msg ?? exception.message);
    }

    reply.status(status).send({
      type: `https://httpstatuses.com/${status}`,
      title: exception.message,
      status,
      detail,
      instance: request.url,
    });
  }
}
