import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/services/api/errors';

/**
 * Pushes server-side field errors (VALIDATION_ERROR details) into react-hook-form so they show
 * under the matching input. Returns true when at least one field error was applied.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !error.details) {
    return false;
  }
  let applied = false;
  for (const detail of error.details) {
    const field = fields.find((f) => f === detail.field);
    if (field) {
      setError(field, { type: 'server', message: 'Утга буруу байна.' });
      applied = true;
    }
  }
  return applied;
}
