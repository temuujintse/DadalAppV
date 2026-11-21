import { ParseUUIDPipe } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

/** `@Param('id', UuidPipe)` — rejects malformed ids with the standard validation envelope. */
export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'Оруулсан мэдээлэл буруу байна.', [
      { field: 'id', errors: ['id must be a UUID'] },
    ]),
});
