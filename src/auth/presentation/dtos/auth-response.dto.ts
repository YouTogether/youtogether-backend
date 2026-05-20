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
 * Shape matches the frontend {@link IAuthRemoteDataSource} contract
 * which maps the response to
 * `UserModel` including embedded token fields.
 *
 * The refresh token is returned in the response body. Transport-level
 * security (HTTPS) is enforced at the infrastructure/deployment level.
 *
 * @see AuthController.register
 * @see IAuthRemoteDataSource.register
 */
export class AuthResponseDto {
  constructor(
    public readonly user: UserProfileDto,
    public readonly accessToken: string,
    public readonly refreshToken: string,
  ) {}

  static fromRegisterResult(params: {
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
