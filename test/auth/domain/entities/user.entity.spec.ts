import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for the domain UserEntity (B-A01-T1 — domain layer).
 *
 * These tests validate the pure domain entity independently of any
 * persistence or framework concern. They verify construction, field
 * assignment, and the UserRole enum contract.
 *
 * @competency Unit test harness written before production code (TDD).
 */
describe('UserEntity (domain)', () => {
  const validParams = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    username: 'testuser',
    role: UserRole.REGISTERED,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  it('should construct a UserEntity with all provided fields', () => {
    const user = new UserEntity(validParams);

    expect(user.id).toBe(validParams.id);
    expect(user.email).toBe(validParams.email);
    expect(user.username).toBe(validParams.username);
    expect(user.role).toBe(UserRole.REGISTERED);
    expect(user.createdAt).toEqual(validParams.createdAt);
    expect(user.updatedAt).toEqual(validParams.updatedAt);
  });

  it('should accept the GUEST role', () => {
    const user = new UserEntity({ ...validParams, role: UserRole.GUEST });

    expect(user.role).toBe(UserRole.GUEST);
  });

  it('should not expose passwordHash, refreshTokenHash, or deletedAt', () => {
    const user = new UserEntity(validParams);
    const userRecord = user as unknown as Record<string, unknown>;

    expect(userRecord.passwordHash).toBeUndefined();
    expect(userRecord.refreshTokenHash).toBeUndefined();
    expect(userRecord.deletedAt).toBeUndefined();
  });
});

describe('UserRole enum (domain)', () => {
  it('should contain exactly two values: registered and guest', () => {
    const values = Object.values(UserRole);

    expect(values).toHaveLength(2);
    expect(values).toContain('registered');
    expect(values).toContain('guest');
  });
});
