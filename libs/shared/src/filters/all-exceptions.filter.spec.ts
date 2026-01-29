import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces/features/arguments-host.interface';
import { HttpAdapterHost } from '@nestjs/core';

import { AllExceptionsFilter } from './all-exceptions.filter';

function mockArgumentsHost(): ArgumentsHost {
  const res = { statusCode: 200 };
  const req = { url: '/api/test' };
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
}

function mockHttpAdapterHost(): {
  httpAdapterHost: HttpAdapterHost;
  reply: jest.Mock<void, [unknown, unknown, number]>;
} {
  const reply = jest.fn<void, [unknown, unknown, number]>();
  const httpAdapterHost = {
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost;
  return { httpAdapterHost, reply };
}

describe('AllExceptionsFilter', () => {
  it('maps BadRequestException with validation-style message to VALIDATION_ERROR and details', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const validationErrors = [
      { property: 'email', constraints: { isEmail: 'Invalid email' } },
      { property: 'password', constraints: { minLength: 'Too short' } },
    ];
    const ex = new BadRequestException(validationErrors);

    filter.catch(ex, host);

    expect(reply).toHaveBeenCalledTimes(1);
    const [res, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          email: 'Invalid email',
          password: 'Too short',
        },
      },
    });
    expect(res).toBeDefined();
  });

  it('maps plain BadRequestException to envelope with code and message', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new BadRequestException('Something wrong');

    filter.catch(ex, host);

    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect((body as { error: { code: string; message: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect((body as { error: { message: string } }).error.message).toBe(
      'Something wrong',
    );
  });

  it('maps NotFoundException to NOT_FOUND and envelope', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new NotFoundException('User not found');

    filter.catch(ex, host);

    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect((body as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    expect((body as { error: { message: string } }).error.message).toBe(
      'User not found',
    );
  });

  it('maps generic HttpException to envelope with code by status', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(ex, host);

    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.FORBIDDEN);
    expect((body as { error: { code: string } }).error.code).toBe('FORBIDDEN');
  });

  it('maps non-HTTP Error to 500 and INTERNAL_SERVER_ERROR', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new Error('Unexpected failure');

    filter.catch(ex, host);

    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect((body as { error: { code: string } }).error.code).toBe(
      'INTERNAL_SERVER_ERROR',
    );
    expect((body as { error: { message: string } }).error.message).toBe(
      'Unexpected failure',
    );
  });

  it('returns envelope shape { error: { code, message } } for any exception', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new HttpException('Bad', HttpStatus.BAD_REQUEST);

    filter.catch(ex, host);

    const body = reply.mock.calls[0][1] as { error: { code: string; message: string } };
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });

  it('maps HttpException 500 to INTERNAL_SERVER_ERROR', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(ex, host);

    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect((body as { error: { code: string } }).error.code).toBe(
      'INTERNAL_SERVER_ERROR',
    );
  });

  it('handles validation item without constraints', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const validationErrors = [
      { property: 'foo', constraints: undefined },
    ] as unknown as { property: string; constraints?: Record<string, string> }[];
    const ex = new BadRequestException(validationErrors);

    filter.catch(ex, host);

    const [, body] = reply.mock.calls[0];
    expect((body as { error: { details: Record<string, string> } }).error.details.foo).toBe(
      'Validation failed',
    );
  });

  it('handles HttpException with array message', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new HttpException(
      { message: ['err1', 'err2'], error: 'Bad' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(ex, host);

    const [, body] = reply.mock.calls[0];
    expect((body as { error: { message: string } }).error.message).toBe(
      'err1; err2',
    );
  });

  it('uses INTERNAL_SERVER_ERROR for unknown status code', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new HttpException('Teapot', 418);

    filter.catch(ex, host);

    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(418);
    expect((body as { error: { code: string } }).error.code).toBe(
      'INTERNAL_SERVER_ERROR',
    );
  });

  it('handles HttpException with non-array non-string message', () => {
    const { httpAdapterHost, reply } = mockHttpAdapterHost();
    const filter = new AllExceptionsFilter(httpAdapterHost);
    const host = mockArgumentsHost();
    const ex = new HttpException({ message: 123 }, HttpStatus.BAD_REQUEST);

    filter.catch(ex, host);

    const [, body] = reply.mock.calls[0];
    expect((body as { error: { message: string } }).error.message).toBe('123');
  });
});
