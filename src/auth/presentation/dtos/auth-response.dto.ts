import { ApiProperty } from '@nestjs/swagger';

import { UserEntity } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * User profile embedded in the authentication response.
 * Excludes all sensitive fields (passwordHash, refreshTokenHash).
 */
export class UserProfileDto {
  @ApiProperty({ example: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f' })
  public readonly id: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  public readonly email: string;

  @ApiProperty({ example: 'jane_doe' })
  public readonly username: string;

  @ApiProperty({ enum: UserRole, example: UserRole.REGISTERED })
  public readonly role: UserRole;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  public readonly createdAt: Date;

  constructor(
    id: string,
    email: string,
    username: string,
    role: UserRole,
    createdAt: Date,
  ) {
    this.id = id;
    this.email = email;
    this.username = username;
    this.role = role;
    this.createdAt = createdAt;
  }

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
  @ApiProperty({ type: UserProfileDto })
  public readonly user: UserProfileDto;

  @ApiProperty({
    description: 'Short-lived JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  public readonly accessToken: string;

  @ApiProperty({
    description: 'Long-lived refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  public readonly refreshToken: string;

  constructor(user: UserProfileDto, accessToken: string, refreshToken: string) {
    this.user = user;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

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
