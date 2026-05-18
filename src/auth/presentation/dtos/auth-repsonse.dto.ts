import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * User profile embedded in the authentication response.
 * Excludes all sensitive fields (passwordHash, refreshTokenHash).
 */
export class UserProfileDto {
  id!: string;
  email!: string;
  username!: string;
  role!: UserRole;
  createdAt!: Date;
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
  user!: UserProfileDto;
  accessToken!: string;
  refreshToken!: string;

  static fromRegisterResult(params: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    createdAt: Date;
    accessToken: string;
    refreshToken: string;
  }): AuthResponseDto {
    const dto = new AuthResponseDto();
    dto.user = {
      id: params.id,
      email: params.email,
      username: params.username,
      role: params.role,
      createdAt: params.createdAt,
    };
    dto.accessToken = params.accessToken;
    dto.refreshToken = params.refreshToken;
    return dto;
  }
}
