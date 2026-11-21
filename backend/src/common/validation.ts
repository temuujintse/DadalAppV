import { ValidationError, ValidationPipe } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { AppException } from './errors/app.exception';
import { ErrorCode } from './errors/error-codes';

export interface FieldError {
  field: string;
  errors: string[];
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own: FieldError[] = e.constraints
      ? [{ field, errors: Object.values(e.constraints) }]
      : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      AppException.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Оруулсан мэдээлэл буруу байна.',
        flatten(errors),
      ),
  });
}

/** Trims string input; leaves other types untouched so validators can reject them. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Lower-cases and trims e-mail input. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
