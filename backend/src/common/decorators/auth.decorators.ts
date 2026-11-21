import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Identity resolved by the auth guard from a verified access token + live session. */
export interface AuthUser {
  userId: string;
  sessionId: string;
}

export type AuthenticatedRequest = { user?: AuthUser; id?: string; ip?: string };

/** Injects the authenticated user. Never read user ids from the request body. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.user as AuthUser;
});
