import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 *
 * Must be used on routes protected by {@link JwtAuthGuard}, which populates
 * `request.user` via {@link JwtStrategy.validate}. On unprotected routes the
 * value is undefined.
 *
 * Usage:
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Get('me')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user.userId;
 * }
 * ```
 *
 * @see JwtAuthGuard
 * @see AuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUser;
  },
);
