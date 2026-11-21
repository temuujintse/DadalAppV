import { ExecutionContext, SetMetadata } from '@nestjs/common';

export const SENSITIVE_RATE_LIMIT_KEY = 'sensitiveRateLimit';

/**
 * Applies the stricter "sensitive" throttler (RATE_LIMIT_AUTH per minute per IP) to a route.
 * Used for login, register, refresh and invite join — endpoints attractive for brute force.
 */
export const SensitiveRateLimit = () => SetMetadata(SENSITIVE_RATE_LIMIT_KEY, true);

export function isSensitiveRoute(context: ExecutionContext): boolean {
  return Reflect.getMetadata(SENSITIVE_RATE_LIMIT_KEY, context.getHandler()) === true;
}
