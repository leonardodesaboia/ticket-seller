import { HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('returns safe publication extensions as RFC 9457 problem details', () => {
    const send = jest.fn();
    const type = jest.fn().mockReturnThis();
    const status = jest.fn().mockReturnValue({ type, send });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/v1/events/event-1/publish' }),
      }),
    } as unknown as ArgumentsHost;
    const exception = new HttpException(
      {
        message: 'Event is not ready for publication',
        code: 'EVENT_PUBLICATION_NOT_READY',
        version: 4,
        issues: [
          {
            code: 'EVENT_STARTS_AT_REQUIRED',
            field: 'startsAt',
            section: 'schedule',
            message: 'Defina a data e o horário de início.',
          },
        ],
        onlineInfo: 'private-access',
        unexpected: 'must-not-be-exposed',
      },
      422,
    );

    new HttpExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(422);
    expect(type).toHaveBeenCalledWith('application/problem+json');
    expect(send).toHaveBeenCalledWith({
      type: 'https://httpstatuses.com/422',
      title: 'Event is not ready for publication',
      status: 422,
      detail: 'Event is not ready for publication',
      instance: '/api/v1/events/event-1/publish',
      code: 'EVENT_PUBLICATION_NOT_READY',
      version: 4,
      issues: [
        {
          code: 'EVENT_STARTS_AT_REQUIRED',
          field: 'startsAt',
          section: 'schedule',
          message: 'Defina a data e o horário de início.',
        },
      ],
    });
  });
});
