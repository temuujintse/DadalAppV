import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export interface AppErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Business error with a stable machine-readable `code` and a user-facing Mongolian `message`.
 * The global exception filter turns it into the standard error envelope.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details } satisfies AppErrorBody, status);
  }

  static badRequest(code: ErrorCode, message: string, details?: unknown) {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, details);
  }
  static unauthorized(code: ErrorCode, message: string) {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }
  static forbidden(code: ErrorCode, message: string) {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }
  static notFound(code: ErrorCode, message: string) {
    return new AppException(HttpStatus.NOT_FOUND, code, message);
  }
  static conflict(code: ErrorCode, message: string, details?: unknown) {
    return new AppException(HttpStatus.CONFLICT, code, message, details);
  }
  static gone(code: ErrorCode, message: string) {
    return new AppException(HttpStatus.GONE, code, message);
  }
}
