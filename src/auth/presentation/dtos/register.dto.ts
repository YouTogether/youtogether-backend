import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Data Transfer Object for the POST /auth/register endpoint.
 *
 * Validation rules align with:
 * - `email`: RFC 5322 format, max 255 characters.
 * - `password`: minimum 8 characters (OWASP baseline for password strength).
 * - `username`: non-empty, max 50 characters.
 *
 * Validation is enforced by NestJS `ValidationPipe` (configured globally).
 * Invalid payloads return HTTP 400 with field-level error messages before
 * the controller method is invoked.
 *
 * @see AuthController.register
 * @competency Input validation as a security measure (OWASP A03:2021)
 */
export class RegisterDto {
  @ApiProperty({
    description: 'User email address (RFC 5322 format)',
    example: 'jane.doe@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255, { message: 'email must not exceed 255 characters' })
  email!: string;

  /**
   * User plaintext password.
   * Must be at least 8 characters. Hashed server-side before storage.
   */
  @ApiProperty({
    description: 'Plaintext password, hashed server-side before storage',
    example: 'securePassword123',
    minLength: 8,
  })
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;

  /**
   * User display name.
   * Must be a non-empty string of at most 50 characters.
   */
  @ApiProperty({
    description: 'Display name',
    example: 'jane_doe',
    maxLength: 50,
  })
  @IsString({ message: 'username must be a string' })
  @MinLength(1, { message: 'username must not be empty' })
  @MaxLength(50, { message: 'username must not exceed 50 characters' })
  username!: string;
}
