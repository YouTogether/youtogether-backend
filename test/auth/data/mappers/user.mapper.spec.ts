import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { UserMapper } from '../../../../src/auth/data/mappers/user.mapper';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for UserMapper (data layer).
 *
 * Validates that the mapper correctly converts between the ORM entity
 * (data layer) and the domain entity, stripping infrastructure-only fields
 * and preserving all domain-relevant data.
 *
 * @competency Unit test harness for the data/domain boundary.
 */
describe('UserMapper', () => {
  const buildOrmEntity = (
    overrides: Partial<UserOrmEntity> = {},
  ): UserOrmEntity => {
    const orm = new UserOrmEntity();
    orm.id = '550e8400-e29b-41d4-a716-446655440000';
    orm.email = 'test@example.com';
    orm.passwordHash = '$2b$12$hashedvalue';
    orm.username = 'testuser';
    orm.role = UserRole.REGISTERED;
    orm.refreshTokenHash = null;
    orm.createdAt = new Date('2025-01-01T00:00:00Z');
    orm.updatedAt = new Date('2025-06-01T00:00:00Z');
    orm.deletedAt = null;
    return Object.assign(orm, overrides);
  };

  describe('toDomain', () => {
    it('should convert a UserOrmEntity to a UserEntity with all domain fields', () => {
      const ormEntity = buildOrmEntity();

      const domainEntity = UserMapper.toDomain(ormEntity);

      expect(domainEntity).toBeInstanceOf(UserEntity);
      expect(domainEntity.id).toBe(ormEntity.id);
      expect(domainEntity.email).toBe(ormEntity.email);
      expect(domainEntity.username).toBe(ormEntity.username);
      expect(domainEntity.role).toBe(UserRole.REGISTERED);
      expect(domainEntity.createdAt).toEqual(ormEntity.createdAt);
      expect(domainEntity.updatedAt).toEqual(ormEntity.updatedAt);
    });

    it('should strip passwordHash from the domain entity', () => {
      const ormEntity = buildOrmEntity({ passwordHash: '$2b$12$secret' });

      const domainEntity = UserMapper.toDomain(ormEntity);

      expect(
        (domainEntity as unknown as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
    });

    it('should strip refreshTokenHash from the domain entity', () => {
      const ormEntity = buildOrmEntity({
        refreshTokenHash: 'active-session-hash',
      });

      const domainEntity = UserMapper.toDomain(ormEntity);

      expect(
        (domainEntity as unknown as Record<string, unknown>).refreshTokenHash,
      ).toBeUndefined();
    });

    it('should strip deletedAt from the domain entity', () => {
      const ormEntity = buildOrmEntity({
        deletedAt: new Date('2025-03-01T00:00:00Z'),
      });

      const domainEntity = UserMapper.toDomain(ormEntity);

      expect(
        (domainEntity as unknown as Record<string, unknown>).deletedAt,
      ).toBeUndefined();
    });

    it('should preserve the GUEST role', () => {
      const ormEntity = buildOrmEntity({ role: UserRole.GUEST });

      const domainEntity = UserMapper.toDomain(ormEntity);

      expect(domainEntity.role).toBe(UserRole.GUEST);
    });
  });

  describe('toOrmEntity', () => {
    it('should produce an object containing email, passwordHash, and username', () => {
      const result = UserMapper.toOrmEntity({
        email: 'new@example.com',
        passwordHash: '$2b$12$newhashedvalue',
        username: 'newuser',
      });

      expect(result.email).toBe('new@example.com');
      expect(result.passwordHash).toBe('$2b$12$newhashedvalue');
      expect(result.username).toBe('newuser');
    });

    it('should not set auto-managed fields (id, timestamps, deletedAt)', () => {
      const result = UserMapper.toOrmEntity({
        email: 'new@example.com',
        passwordHash: '$2b$12$newhashedvalue',
        username: 'newuser',
      });

      expect(result.id).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();
    });

    it('should not set role (lets the database default apply)', () => {
      const result = UserMapper.toOrmEntity({
        email: 'new@example.com',
        passwordHash: '$2b$12$newhashedvalue',
        username: 'newuser',
      });

      expect(result.role).toBeUndefined();
    });

    it('should not set refreshTokenHash (assigned only after login)', () => {
      const result = UserMapper.toOrmEntity({
        email: 'new@example.com',
        passwordHash: '$2b$12$newhashedvalue',
        username: 'newuser',
      });

      expect(result.refreshTokenHash).toBeUndefined();
    });
  });
});
