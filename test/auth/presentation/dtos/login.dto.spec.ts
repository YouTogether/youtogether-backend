import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { LoginDto } from '../../../../src/auth/presentation/dtos/login.dto';

/**
 * Unit tests for LoginDto.
 *
 * Each test calls `validate()` from class-validator directly, without
 * booting a NestJS application. This isolates decorator configuration
 * from transport concerns and makes failures immediately traceable to
 * the responsible constraint.
 *
 * Scenarios covered:
 * - Valid payload produces no validation errors.
 * - Invalid email format is rejected.
 * - Missing email is rejected.
 * - Missing password is rejected.
 * - Empty password string is rejected.
 * - Non-string values for each field are rejected.
 *
 * @competency Unit test harness covering DTO validation rules.
 * @competency Test scenarios verifying input constraints.
 */
describe('LoginDto', () => {
  const buildDto = (overrides: Record<string, unknown> = {}): LoginDto => {
    const payload: Record<string, unknown> = {
      email: 'valid@example.com',
      password: 'securepassword',
      ...overrides,
    };
    return plainToInstance(LoginDto, payload);
  };

  const constraintsOf = (
    errors: ValidationError[],
    property: string,
  ): string[] => {
    const match = errors.find((e) => e.property === property);
    return match ? Object.keys(match.constraints ?? {}) : [];
  };

  // --- Valid payload ---

  it('should pass validation for a valid email and password', async () => {
    const errors = await validate(buildDto());

    expect(errors).toHaveLength(0);
  });

  // --- email field ---

  describe('email', () => {
    it('should reject an invalid email format', async () => {
      const errors = await validate(buildDto({ email: 'not-an-email' }));

      expect(constraintsOf(errors, 'email')).toContain('isEmail');
    });

    it('should reject a missing email', async () => {
      const errors = await validate(buildDto({ email: undefined }));

      expect(constraintsOf(errors, 'email').length).toBeGreaterThan(0);
    });

    it('should reject a non-string email', async () => {
      const errors = await validate(buildDto({ email: 12345 }));

      expect(constraintsOf(errors, 'email').length).toBeGreaterThan(0);
    });

    it('should accept a complex but valid RFC 5322 email', async () => {
      const errors = await validate(
        buildDto({ email: 'user+tag@sub.domain.co.uk' }),
      );

      expect(constraintsOf(errors, 'email')).toHaveLength(0);
    });
  });

  // --- password field ---

  describe('password', () => {
    it('should reject a missing password', async () => {
      const errors = await validate(buildDto({ password: undefined }));

      expect(constraintsOf(errors, 'password').length).toBeGreaterThan(0);
    });

    it('should reject an empty string password', async () => {
      const errors = await validate(buildDto({ password: '' }));

      expect(constraintsOf(errors, 'password')).toContain('minLength');
    });

    it('should reject a non-string password', async () => {
      const errors = await validate(buildDto({ password: 123456 }));

      expect(constraintsOf(errors, 'password').length).toBeGreaterThan(0);
    });

    it('should accept a single-character password (domain handles strength)', async () => {
      const errors = await validate(buildDto({ password: 'x' }));

      expect(constraintsOf(errors, 'password')).toHaveLength(0);
    });
  });
});
