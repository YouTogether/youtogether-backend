import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * User profile embedded in the authentication response.
 * Excludes all sensitive fields (passwordHash, refreshTokenHash).
 */
export class UserProfileDto {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly username: string,
    public readonly role: UserRole,
    public readonly createdAt: Date,
  ) {}
}

/**
 * HTTP response body for successful authentication operations
 * (POST /auth/register, POST /auth/login).
 *
 * Shape aligns with the frontend IAuthRemoteDataSource.
 *
 * @see AuthController.register
 * @see AuthController.login
 */
export class AuthResponseDto {
  constructor(
    public readonly user: UserProfileDto,
    public readonly accessToken: string,
    public readonly refreshToken: string,
  ) {}

  static fromAuthResult(params: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    createdAt: Date;
    accessToken: string;
    refreshToken: string;
  }): AuthResponseDto {
    return new AuthResponseDto(
      new UserProfileDto(
        params.id,
        params.email,
        params.username,
        params.role,
        params.createdAt,
      ),
      params.accessToken,
      params.refreshToken,
    );
  }
}
