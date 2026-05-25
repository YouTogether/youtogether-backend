import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Reusable authentication guard enforcing JWT validation on protected routes.
 *
 * Applied via `@UseGuards(JwtAuthGuard)` at the controller or handler level.
 * It triggers the `'jwt'` Passport strategy ({@link JwtStrategy}); requests
 * without a valid, non-expired Bearer token receive an automatic 401 response.
 *
 * This guard is exported from the {@link AuthModule} so that other modules
 * (room, video) can reuse it without redefining authentication logic.
 *
 * Usage:
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Get('me')
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 * ```
 *
 * @see JwtStrategy — the underlying Passport strategy
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
