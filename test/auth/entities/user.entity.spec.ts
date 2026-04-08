import { DataSource } from 'typeorm';

import { User } from '../../../src/auth/entities/user.entity';
import { UserRole } from '../../../src/auth/enums/user-role.enum';

/**
 * Unit tests for the User entity (B-A01-T1).
 *
 * These tests validate the TypeORM metadata configuration of the User entity
 * against the data model specification. They do NOT require a running database;
 * they inspect the entity metadata registered by TypeORM decorators.
 *
 * @competency Unit test harness covering the User entity definition.
 */
describe('User Entity', () => {
  let dataSource: DataSource;

  beforeAll(() => {
    // Initialize an in-memory DataSource to load entity metadata
    // without requiring a real PostgreSQL connection.
    dataSource = new DataSource({
      type: 'postgres',
      entities: [User],
      synchronize: false,
    });

    // We only need metadata, not an actual connection.
    // TypeORM loads metadata upon DataSource instantiation.
  });

  it('should be mapped to the "users" table', () => {
    const metadata = dataSource.getMetadata(User);
    expect(metadata.tableName).toBe('users');
  });

  it('should have a UUID primary key column named "id"', () => {
    const metadata = dataSource.getMetadata(User);
    const pkColumn = metadata.columns.find((col) => col.propertyName === 'id');

    expect(pkColumn).toBeDefined();
    expect(pkColumn!.isPrimary).toBe(true);
    expect(pkColumn!.type).toBe('uuid');
    expect(pkColumn!.generationStrategy).toBe('uuid');
  });

  it('should have an email column with VARCHAR(255) and NOT NULL', () => {
    const metadata = dataSource.getMetadata(User);
    const column = metadata.columns.find((col) => col.propertyName === 'email');

    expect(column).toBeDefined();
    expect(column!.type).toBe('varchar');
    expect(column!.length).toBe('255');
    expect(column!.isNullable).toBe(false);
  });

  it('should have a password_hash column with VARCHAR(255) and NOT NULL', () => {
    const metadata = dataSource.getMetadata(User);
    const column = metadata.columns.find(
      (col) => col.propertyName === 'passwordHash',
    );

    expect(column).toBeDefined();
    expect(column!.databaseName).toBe('password_hash');
    expect(column!.type).toBe('varchar');
    expect(column!.length).toBe('255');
    expect(column!.isNullable).toBe(false);
  });

  it('should have a username column with VARCHAR(50) and NOT NULL', () => {
    const metadata = dataSource.getMetadata(User);
    const column = metadata.columns.find(
      (col) => col.propertyName === 'username',
    );

    expect(column).toBeDefined();
    expect(column!.type).toBe('varchar');
    expect(column!.length).toBe('50');
    expect(column!.isNullable).toBe(false);
  });

  it('should have a role column with enum type defaulting to REGISTERED', () => {
    const metadata = dataSource.getMetadata(User);
    const column = metadata.columns.find((col) => col.propertyName === 'role');

    expect(column).toBeDefined();
    expect(column!.type).toBe('enum');
    expect(column!.default).toBe(`'${UserRole.REGISTERED}'`);
    expect(column!.isNullable).toBe(false);
  });

  it('should have a nullable refresh_token_hash column', () => {
    const metadata = dataSource.getMetadata(User);
    const column = metadata.columns.find(
      (col) => col.propertyName === 'refreshTokenHash',
    );

    expect(column).toBeDefined();
    expect(column!.databaseName).toBe('refresh_token_hash');
    expect(column!.type).toBe('varchar');
    expect(column!.length).toBe('255');
    expect(column!.isNullable).toBe(true);
  });

  it('should have created_at, updated_at, and deleted_at timestamp columns', () => {
    const metadata = dataSource.getMetadata(User);

    const createdAt = metadata.columns.find(
      (col) => col.propertyName === 'createdAt',
    );
    const updatedAt = metadata.columns.find(
      (col) => col.propertyName === 'updatedAt',
    );
    const deletedAt = metadata.columns.find(
      (col) => col.propertyName === 'deletedAt',
    );

    expect(createdAt).toBeDefined();
    expect(createdAt!.databaseName).toBe('created_at');
    expect(createdAt!.isCreateDate).toBe(true);

    expect(updatedAt).toBeDefined();
    expect(updatedAt!.databaseName).toBe('updated_at');
    expect(updatedAt!.isUpdateDate).toBe(true);

    expect(deletedAt).toBeDefined();
    expect(deletedAt!.databaseName).toBe('deleted_at');
    expect(deletedAt!.isDeleteDate).toBe(true);
    expect(deletedAt!.isNullable).toBe(true);
  });

  it('should define a partial unique index on email for active users', () => {
    const metadata = dataSource.getMetadata(User);
    const emailIndex = metadata.indices.find(
      (idx) => idx.name === 'IDX_users_email_active',
    );

    expect(emailIndex).toBeDefined();
    expect(emailIndex!.isUnique).toBe(true);
    expect(emailIndex!.where).toBe('"deleted_at" IS NULL');
  });

  it('should define an index on deleted_at', () => {
    const metadata = dataSource.getMetadata(User);
    const deletedAtIndex = metadata.indices.find(
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
