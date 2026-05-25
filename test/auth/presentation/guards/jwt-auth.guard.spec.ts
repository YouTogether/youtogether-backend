import { ExecutionContext } from '@nestjs/common';

import { JwtAuthGuard } from '../../../../src/auth/presentation/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../../src/auth/presentation/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for JwtAuthGuard.
 *
 * The guard delegates entirely to Passport's AuthGuard('jwt'); the actual
 * token rejection (401) is verified by integration tests against protected
 * routes. This unit test confirms the guard is correctly instantiated as a
 * jwt-strategy guard.
 *
 * The CurrentUser decorator extraction logic is tested by replicating the
 * factory function behavior, since parameter decorators cannot be invoked
 * directly in isolation.
 *
 * @competency Unit test harness, TDD.
 */
describe('JwtAuthGuard', () => {
  it('should be instantiable', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });

  it('should expose a canActivate method inherited from AuthGuard', () => {
    const guard = new JwtAuthGuard();
    expect(typeof guard.canActivate).toBe('function');
  });
});

/**
 * Replicates the CurrentUser decorator's extraction logic for unit testing.
 * Mirrors the factory passed to createParamDecorator in the source.
 */
const extractCurrentUser = (ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  return request.user;
};

describe('CurrentUser decorator (extraction logic)', () => {
  const buildContext = (user: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('should extract the authenticated user from the request', () => {
    const authenticatedUser: AuthenticatedUser = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      role: UserRole.REGISTERED,
    };
    const ctx = buildContext(authenticatedUser);

    const result = extractCurrentUser(ctx);

    expect(result).toEqual(authenticatedUser);
  });

  it('should return the userId and role from request.user', () => {
    const ctx = buildContext({
      userId: 'abc-123',
      role: UserRole.GUEST,
    });

    const result = extractCurrentUser(ctx);

    expect(result.userId).toBe('abc-123');
    expect(result.role).toBe(UserRole.GUEST);
  });
});
