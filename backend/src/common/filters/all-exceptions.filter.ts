import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AppErrorBody } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

interface ErrorEnvelope {
  success: false;
  error: AppErrorBody & { requestId?: string };
}

const DEFAULT_MESSAGES: Partial<Record<number, { code: ErrorCode; message: string }>> = {
  [HttpStatus.BAD_REQUEST]: { code: ErrorCode.BAD_REQUEST, message: 'Хүсэлт буруу байна.' },
  [HttpStatus.UNAUTHORIZED]: { code: ErrorCode.UNAUTHORIZED, message: 'Нэвтрэх шаардлагатай.' },
  [HttpStatus.FORBIDDEN]: {
    code: ErrorCode.FORBIDDEN,
    message: 'Танд энэ үйлдлийг хийх эрх алга.',
  },
  [HttpStatus.NOT_FOUND]: { code: ErrorCode.NOT_FOUND, message: 'Хайсан зүйл олдсонгүй.' },
  [HttpStatus.CONFLICT]: { code: ErrorCode.CONFLICT, message: 'Өгөгдөл зөрчилдөж байна.' },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: ErrorCode.RATE_LIMITED,
    message: 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.',
  },
};

/**
 * Converts every error into `{ success: false, error: { code, message, details?, requestId } }`.
 * Internal details (stack traces, SQL, Prisma meta) never leave the server.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    const { status, body } = this.toErrorBody(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${status} [${req.id ?? '-'}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const envelope: ErrorEnvelope = {
      success: false,
      error: { ...body, requestId: req.id },
    };
    res.status(status).json(envelope);
  }

  private toErrorBody(exception: unknown): { status: number; body: AppErrorBody } {
    if (exception instanceof ThrottlerException) {
      return { status: HttpStatus.TOO_MANY_REQUESTS, body: DEFAULT_MESSAGES[429]! };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (isAppErrorBody(response)) {
        return { status, body: response };
      }
      const fallback = DEFAULT_MESSAGES[status] ?? {
        code: status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST,
        message: status >= 500 ? 'Серверт алдаа гарлаа.' : 'Хүсэлт буруу байна.',
      };
      return { status, body: fallback };
    }

    // Errors thrown by the body parser before any controller runs (http-errors objects).
    const parser = bodyParserError(exception);
    if (parser) return parser;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, body: DEFAULT_MESSAGES[409]! };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, body: DEFAULT_MESSAGES[404]! };
      }
      if (exception.code === 'P2034') {
        // Serializable transaction lost a race — safe for the client to retry.
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ErrorCode.CONFLICT,
            message: 'Өөр өөрчлөлттэй давхцлаа. Дахин оролдоно уу.',
          },
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
      },
    };
  }
}

function isAppErrorBody(value: unknown): value is AppErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AppErrorBody).code === 'string' &&
    typeof (value as AppErrorBody).message === 'string'
  );
}

/** Maps body-parser failures (malformed JSON, oversized body) to 4xx instead of 500. */
function bodyParserError(exception: unknown): { status: number; body: AppErrorBody } | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { type, status } = exception as { type?: unknown; status?: unknown };
  if (type === 'entity.too.large') {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      body: { code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Хүсэлтийн хэмжээ хэт том байна.' },
    };
  }
  if (
    type === 'entity.parse.failed' ||
    type === 'encoding.unsupported' ||
    type === 'charset.unsupported'
  ) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: { code: ErrorCode.BAD_REQUEST, message: 'Хүсэлтийн өгөгдөл буруу форматтай байна.' },
    };
  }
  if (typeof type === 'string' && typeof status === 'number' && status >= 400 && status < 500) {
    return { status, body: { code: ErrorCode.BAD_REQUEST, message: 'Хүсэлт буруу байна.' } };
  }
  return null;
}
