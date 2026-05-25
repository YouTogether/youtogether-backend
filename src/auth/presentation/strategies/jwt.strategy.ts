import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '../../data/interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Passport JWT strategy for validating access tokens on protected routes.
 *
 * The strategy is configured to:
 * - Extract the token from the `Authorization: Bearer <token>` header.
 * - Reject expired tokens (`ignoreExpiration: false`).
 * - Verify the signature against the configured `JWT_SECRET`.
 *
 * On successful verification, Passport invokes {@link validate}, whose return
 * value is attached to the Express request as `request.user`. The
 * {@link CurrentUser} decorator then exposes it to route handlers.
 *
 * No database lookup is performed here. The token's cryptographic validity is
 * sufficient to authenticate the request; the `sub` and `role` claims are
 * trusted because the signature guarantees their integrity. Endpoints that
 * require the full, current user record load it explicitly.
 *
 * @see JwtAuthGuard — the guard that triggers this strategy
 * @competency Token signature and expiration enforcement (OWASP A07:2021)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Maps the verified JWT payload to the authenticated user object.
   *
   * Passport calls this method only after the token signature and expiration
   * have been validated. The returned object becomes `request.user`.
   *
   * @param payload - The decoded and verified JWT payload.
   * @returns The {@link AuthenticatedUser} attached to the request.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      role: payload.role,
    };
  }
}
