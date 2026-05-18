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
  /**
   * User email address.
   * Must be a valid RFC 5322 email and at most 255 characters.
   */
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255, { message: 'email must not exceed 255 characters' })
  email!: string;

  /**
   * User plaintext password.
   * Must be at least 8 characters. Hashed server-side before storage.
   */
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;

  /**
   * User display name.
   * Must be a non-empty string of at most 50 characters.
   */
  @IsString({ message: 'username must be a string' })
  @MinLength(1, { message: 'username must not be empty' })
  @MaxLength(50, { message: 'username must not exceed 50 characters' })
  username!: string;
}
