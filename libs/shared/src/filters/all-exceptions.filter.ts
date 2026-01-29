import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export interface ValidationErrorItem {
  property?: string;
  constraints?: Record<string, string>;
}

function isValidationMessage(
  msg: unknown,
): msg is ValidationErrorItem[] {
  return (
    Array.isArray(msg) &&
    msg.length > 0 &&
    msg.every(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        ('property' in m || 'constraints' in m),
    )
  );
}

function validationToDetails(errors: ValidationErrorItem[]): Record<string, string> {
  const details: Record<string, string> = {};
  for (const e of errors) {
    const key = (e.property as string) ?? 'unknown';
    const first = e.constraints
      ? Object.values(e.constraints)[0]
      : 'Validation failed';
    details[key] = typeof first === 'string' ? first : 'Validation failed';
  }
  return details;
}

function pickCodeByStatus(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.INTERNAL_SERVER_ERROR:
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const obj = typeof body === 'object' && body !== null ? body : { message: String(body) };
      const msg = (obj as { message?: unknown }).message;

      if (
        (exception instanceof BadRequestException || status === HttpStatus.BAD_REQUEST) &&
        isValidationMessage(msg)
      ) {
        code = 'VALIDATION_ERROR';
        details = validationToDetails(msg);
        message = 'Validation failed';
      } else {
        const customCode = (obj as { code?: string }).code;
        code =
          typeof customCode === 'string' && customCode.length > 0
            ? customCode
            : pickCodeByStatus(status);
        if (Array.isArray(msg)) {
          message = msg.map((m) => (typeof m === 'string' ? m : String(m))).join('; ');
        } else if (typeof msg === 'string') {
          message = msg;
        } else if (msg != null) {
          message = String(msg);
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Internal server error';
      if (status >= 500) {
        const path = req?.url ?? 'unknown';
        this.logger.error(
          `${exception.message} (path: ${path})`,
          exception.stack,
        );
      }
    }

    const envelope = {
      error: {
        code,
        message,
        ...(details && Object.keys(details).length > 0 ? { details } : {}),
      },
    };

    httpAdapter.reply(res, envelope, status);
  }
}
