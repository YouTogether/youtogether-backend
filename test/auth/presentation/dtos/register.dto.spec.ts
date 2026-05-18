import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { RegisterDto } from '../../../../src/auth/presentation/dtos/register.dto';

/**
 * Unit tests for RegisterDto validation.
 *
 * Uses `class-validator` directly to test validation rules without
 * bootstrapping the full NestJS application. Each test verifies a single
 * constraint, making failures easy to diagnose.
 *
 * @competency Unit test harness for DTO validation rules.
 * @competency Test scenario: input validation as security measure.
 */
describe('RegisterDto (validation)', () => {
  /**
   * Helper: build a RegisterDto instance from a plain object and run
   * class-validator against it. Returns the array of constraint violations.
   */
  async function validateDto(
    plain: Record<string, unknown>,
  ): Promise<string[]> {
    const dto = plainToInstance(RegisterDto, plain);
    const errors = await validate(dto);
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  // Valid payload

  it('should produce no validation errors for a valid payload', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: 'securepassword',
      username: 'validuser',
    });

    expect(errors).toHaveLength(0);
  });

  // Email constraints

  it('should fail when email is missing', async () => {
    const errors = await validateDto({
      password: 'securepassword',
      username: 'validuser',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when email is not a valid RFC 5322 address', async () => {
    const errors = await validateDto({
      email: 'not-an-email',
      password: 'securepassword',
      username: 'validuser',
    });

    expect(errors.some((e) => e.toLowerCase().includes('email'))).toBe(true);
  });

  it('should fail when email exceeds 255 characters', async () => {
    const errors = await validateDto({
      email: `${'a'.repeat(64)}@${'test'.repeat(47)}.com`, // 64 + 4 * 47 + 4 = 255+1
      password: 'securepassword',
      username: 'validuser',
    });

    expect(errors.some((e) => e.includes('255'))).toBe(true);
  });

  // Password constraints

  it('should fail when password is shorter than 8 characters', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: '1234567',
      username: 'validuser',
    });

    expect(errors.some((e) => e.includes('8'))).toBe(true);
  });

  it('should fail when password is missing', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      username: 'validuser',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  // Username constraints

  it('should fail when username is missing', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: 'securepassword',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when username is an empty string', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: 'securepassword',
      username: '',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when username exceeds 50 characters', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: 'securepassword',
      username: 'a'.repeat(51),
    });

    expect(errors.some((e) => e.includes('50'))).toBe(true);
  });

  it('should pass when username is exactly 50 characters', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: 'securepassword',
      username: 'a'.repeat(50),
    });

    expect(errors).toHaveLength(0);
  });

  it('should pass when password is exactly 8 characters', async () => {
    const errors = await validateDto({
      email: 'valid@example.com',
      password: '12345678',
      username: 'validuser',
    });

    expect(errors).toHaveLength(0);
  });
});
