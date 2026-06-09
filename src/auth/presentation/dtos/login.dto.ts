import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Data Transfer Object for the POST /auth/login endpoint.
 *
 * Validation is minimal: only presence and basic format are enforced.
 * Detailed credential validation (bcrypt comparison) is the repository's
 * responsibility. A generic 401 is returned for any credential mismatch.
 *
 * @see AuthController.login
 * @competency Input sanitization before reaching domain logic
 */
export class LoginDto {
  /**
   * User email address.
   * Must be a valid email format to prevent unnecessary database queries.
   */
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  /**
   * User plaintext password.
   * Minimum length of 1 character to reject empty strings.
   * The bcrypt comparison handles the actual credential check.
   */
  @IsString({ message: 'password must be a string' })
  @MinLength(1, { message: 'password must not be empty' })
  password!: string;
}
