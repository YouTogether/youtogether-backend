import { ColumnMetadataArgs } from 'typeorm/metadata-args/ColumnMetadataArgs';
import { GeneratedMetadataArgs } from 'typeorm/metadata-args/GeneratedMetadataArgs';
import { IndexMetadataArgs } from 'typeorm/metadata-args/IndexMetadataArgs';
import { TableMetadataArgs } from 'typeorm/metadata-args/TableMetadataArgs';
import { getMetadataArgsStorage } from 'typeorm';

import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for the UserOrmEntity TypeORM metadata.
 *
 * These tests inspect the entity metadata registered by TypeORM decorators
 * without requiring a running database. They verify that the ORM configuration
 * matches the data model specification.
 *
 * @competency Unit test harness covering the persistence entity.
 * @competency Test scenarios verifying schema conformance.
 */
describe('UserOrmEntity (data layer — TypeORM metadata)', () => {
  const storage = getMetadataArgsStorage();

  const tables: TableMetadataArgs[] = storage.tables.filter(
    (table) => table.target === UserOrmEntity,
  );
  const columns: ColumnMetadataArgs[] = storage.columns.filter(
    (column) => column.target === UserOrmEntity,
  );
  const indices: IndexMetadataArgs[] = storage.indices.filter(
    (index) => index.target === UserOrmEntity,
  );
  const generations: GeneratedMetadataArgs[] = storage.generations.filter(
    (generation) => generation.target === UserOrmEntity,
  );

  it('should be mapped to the "users" table', () => {
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('users');
  });

  it('should have a UUID primary key column named "id" with uuid generation strategy', () => {
    const idColumn = columns.find((col) => col.propertyName === 'id');

    expect(idColumn).toBeDefined();
    expect(idColumn?.options.primary).toBe(true);
    expect(idColumn?.options.type).toBe('uuid');

    const idGeneration = generations.find((gen) => gen.propertyName === 'id');
    expect(idGeneration).toBeDefined();
    expect(idGeneration?.strategy).toBe('uuid');
  });

  it('should have an email column with VARCHAR(255) and NOT NULL', () => {
    const column = columns.find((col) => col.propertyName === 'email');

    expect(column).toBeDefined();
    expect(column?.options.type).toBe('varchar');
    expect(column?.options.length).toBe(255);
    expect(column?.options.nullable).toBe(false);
  });

  it('should have a passwordHash column mapped to "password_hash" with VARCHAR(255) and NOT NULL', () => {
    const column = columns.find((col) => col.propertyName === 'passwordHash');

    expect(column).toBeDefined();
    expect(column?.options.name).toBe('password_hash');
    expect(column?.options.type).toBe('varchar');
    expect(column?.options.length).toBe(255);
    expect(column?.options.nullable).toBe(false);
  });

  it('should have a username column with VARCHAR(50) and NOT NULL', () => {
    const column = columns.find((col) => col.propertyName === 'username');

    expect(column).toBeDefined();
    expect(column?.options.type).toBe('varchar');
    expect(column?.options.length).toBe(50);
    expect(column?.options.nullable).toBe(false);
  });

  it('should have a role column with enum type defaulting to REGISTERED', () => {
    const column = columns.find((col) => col.propertyName === 'role');

    expect(column).toBeDefined();
    expect(column?.options.type).toBe('enum');
    expect(column?.options.enum).toBe(UserRole);
    // Args storage holds the raw JS default value, not the SQL-quoted form.
    expect(column?.options.default).toBe(UserRole.REGISTERED);
    expect(column?.options.nullable).toBe(false);
  });

  it('should have a nullable refreshTokenHash column mapped to "refresh_token_hash"', () => {
    const column = columns.find(
      (col) => col.propertyName === 'refreshTokenHash',
    );

    expect(column).toBeDefined();
    expect(column?.options.name).toBe('refresh_token_hash');
    expect(column?.options.type).toBe('varchar');
    expect(column?.options.length).toBe(255);
    expect(column?.options.nullable).toBe(true);
  });

  it('should have createdAt as a CreateDateColumn mapped to "created_at"', () => {
    const column = columns.find((col) => col.propertyName === 'createdAt');

    expect(column).toBeDefined();
    expect(column?.mode).toBe('createDate');
    expect(column?.options.name).toBe('created_at');
    expect(column?.options.type).toBe('timestamptz');
  });

  it('should have updatedAt as an UpdateDateColumn mapped to "updated_at"', () => {
    const column = columns.find((col) => col.propertyName === 'updatedAt');

    expect(column).toBeDefined();
    expect(column?.mode).toBe('updateDate');
    expect(column?.options.name).toBe('updated_at');
    expect(column?.options.type).toBe('timestamptz');
  });

  it('should have deletedAt as a nullable DeleteDateColumn mapped to "deleted_at"', () => {
    const column = columns.find((col) => col.propertyName === 'deletedAt');

    expect(column).toBeDefined();
    expect(column?.mode).toBe('deleteDate');
    expect(column?.options.name).toBe('deleted_at');
    expect(column?.options.type).toBe('timestamptz');
    expect(column?.options.nullable).toBe(true);
  });

  it('should define a partial unique index on email restricted to active users', () => {
    const emailIndex = indices.find(
      (index) => index.name === 'IDX_users_email_active',
    );

    expect(emailIndex).toBeDefined();
    expect(emailIndex?.unique).toBe(true);
    expect(emailIndex?.where).toBe('"deleted_at" IS NULL');
    expect(emailIndex?.columns).toEqual(['email']);
  });

  it('should define an index on deletedAt', () => {
    const deletedAtIndex = indices.find(
      (index) => index.name === 'IDX_users_deleted_at',
    );

    expect(deletedAtIndex).toBeDefined();
    expect(deletedAtIndex?.columns).toEqual(['deletedAt']);
  });
});
