import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

interface SafeProblemIssue {
  code: string;
  field: string;
  section: string;
  message: string;
}

function parseSafeIssues(value: unknown): SafeProblemIssue[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const issues: SafeProblemIssue[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return undefined;
    const record = item as Record<string, unknown>;
    if (
      typeof record['code'] !== 'string' ||
      typeof record['field'] !== 'string' ||
      typeof record['section'] !== 'string' ||
      typeof record['message'] !== 'string'
    ) {
      return undefined;
    }
    issues.push({
      code: record['code'],
      field: record['field'],
      section: record['section'],
      message: record['message'],
    });
  }
  return issues;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let detail: string;
    let code: string | undefined;
    let version: number | undefined;
    let issues: SafeProblemIssue[] | undefined;
    if (typeof exceptionResponse === 'string') {
      detail = exceptionResponse;
    } else {
      const response = exceptionResponse as Record<string, unknown>;
      const msg = response['message'];
      detail = Array.isArray(msg) ? msg.join(', ') : String(msg ?? exception.message);
      if (typeof response['code'] === 'string') code = response['code'];
      if (typeof response['version'] === 'number' && Number.isInteger(response['version'])) {
        version = response['version'];
      }
      issues = parseSafeIssues(response['issues']);
    }

    const problem: Record<string, unknown> = {
      type: `https://httpstatuses.com/${status}`,
      title: exception.message,
      status,
      detail,
      instance: request.url,
    };
    if (code !== undefined) problem['code'] = code;
    if (version !== undefined) problem['version'] = version;
    if (issues !== undefined) problem['issues'] = issues;

    reply.status(status).type('application/problem+json').send(problem);
  }
}
