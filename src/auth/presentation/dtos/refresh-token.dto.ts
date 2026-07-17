import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

/**
 * Data Transfer Object for the POST /auth/refresh endpoint.
 *
 * `@IsJWT()` validates the structural format (three base64url segments
 * separated by dots) before the value reaches the domain layer. It does
 * NOT verify the signature or expiration — that cryptographic check is
 * the repository's responsibility via {@link TokenService}.
 *
 * @see AuthController.refresh
 * @competency Input format validation before domain logic
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token JWT previously issued to the client',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsJWT({ message: 'refreshToken must be a valid JWT' })
  refreshToken!: string;
}
