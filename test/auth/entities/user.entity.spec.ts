import { getMetadataArgsStorage } from 'typeorm';

import { User } from '../../../src/auth/entities/user.entity';
import { UserRole } from '../../../src/auth/enums/user-role.enum';

/**
 * Unit tests for the User entity (B-A01-T1).
 *
 * These tests validate the TypeORM decorator metadata of the User entity
 * against the data model specification. They do NOT require a running database;
 * they inspect the global metadata args storage populated at import time.
 *
 * @competency Unit test harness covering the User entity definition.
 */
describe('User Entity', () => {
  const storage = getMetadataArgsStorage();

  const getColumn = (propertyName: string) =>
    storage.columns.find(
      (col) => col.target === User && col.propertyName === propertyName,
    );

  const getIndices = () => storage.indices.filter((idx) => idx.target === User);

  it('should be mapped to the "users" table', () => {
    const table = storage.tables.find((t) => t.target === User);

    expect(table).toBeDefined();
    expect(table!.name).toBe('users');
  });

  it('should have a UUID primary generated column named "id"', () => {
    const generated = storage.generations.find(
      (g) => g.target === User && g.propertyName === 'id',
    );

    expect(generated).toBeDefined();
    expect(generated!.strategy).toBe('uuid');
  });

  it('should have an email column with VARCHAR(255) and NOT NULL', () => {
    const column = getColumn('email');

    expect(column).toBeDefined();
    expect(column!.options.type).toBe('varchar');
    expect(column!.options.length).toBe(255);
    expect(column!.options.nullable).toBe(false);
  });

  it('should have a password_hash column with VARCHAR(255) and NOT NULL', () => {
    const column = getColumn('passwordHash');

    expect(column).toBeDefined();
    expect(column!.options.name).toBe('password_hash');
    expect(column!.options.type).toBe('varchar');
    expect(column!.options.length).toBe(255);
    expect(column!.options.nullable).toBe(false);
  });

  it('should have a username column with VARCHAR(50) and NOT NULL', () => {
    const column = getColumn('username');

    expect(column).toBeDefined();
    expect(column!.options.type).toBe('varchar');
    expect(column!.options.length).toBe(50);
    expect(column!.options.nullable).toBe(false);
  });

  it('should have a role column with enum type defaulting to REGISTERED', () => {
    const column = getColumn('role');

    expect(column).toBeDefined();
    expect(column!.options.type).toBe('enum');
    expect(column!.options.enum).toEqual(UserRole);
    expect(column!.options.default).toBe(UserRole.REGISTERED);
    expect(column!.options.nullable).toBe(false);
  });

  it('should have a nullable refresh_token_hash column', () => {
    const column = getColumn('refreshTokenHash');

    expect(column).toBeDefined();
    expect(column!.options.name).toBe('refresh_token_hash');
    expect(column!.options.type).toBe('varchar');
    expect(column!.options.length).toBe(255);
    expect(column!.options.nullable).toBe(true);
  });

  it('should have created_at, updated_at, and deleted_at timestamp columns', () => {
    const createdAt = getColumn('createdAt');
    const updatedAt = getColumn('updatedAt');
    const deletedAt = getColumn('deletedAt');

    expect(createdAt).toBeDefined();
    expect(createdAt!.options.name).toBe('created_at');
    expect(createdAt!.mode).toBe('createDate');

    expect(updatedAt).toBeDefined();
    expect(updatedAt!.options.name).toBe('updated_at');
    expect(updatedAt!.mode).toBe('updateDate');

    expect(deletedAt).toBeDefined();
    expect(deletedAt!.options.name).toBe('deleted_at');
    expect(deletedAt!.mode).toBe('deleteDate');
    expect(deletedAt!.options.nullable).toBe(true);
  });

  it('should define a partial unique index on email for active users', () => {
    const indices = getIndices();
    const emailIndex = indices.find(
      (idx) => idx.name === 'IDX_users_email_active',
    );

    expect(emailIndex).toBeDefined();
    expect(emailIndex!.unique).toBe(true);
    expect(emailIndex!.where).toBe('"deleted_at" IS NULL');
  });

  it('should define an index on deleted_at', () => {
    const indices = getIndices();
    const deletedAtIndex = indices.find(
      (idx) => idx.name === 'IDX_users_deleted_at',
    );

    expect(deletedAtIndex).toBeDefined();
  });
});

describe('UserRole Enum', () => {
  it('should contain exactly two values: registered and guest', () => {
    const values = Object.values(UserRole);
    expect(values).toHaveLength(2);
    expect(values).toContain('registered');
    expect(values).toContain('guest');
  });
});
