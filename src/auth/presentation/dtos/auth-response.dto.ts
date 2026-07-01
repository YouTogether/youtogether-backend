import { UserEntity } from '../../domain/entities/user.entity';
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

  /**
   * Builds a {@link UserProfileDto} from a domain {@link UserEntity}.
   *
   * Used directly by GET /auth/me, and indirectly by {@link AuthResponseDto.fromAuthResult}
   * for register/login/refresh.
   *
   * @see AuthController.me
   */
  static fromUserEntity(user: UserEntity): UserProfileDto {
    return new UserProfileDto(
      user.id,
      user.email,
      user.username,
      user.role,
      user.createdAt,
    );
  }
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
