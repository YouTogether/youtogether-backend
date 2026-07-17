import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * User entity — root of the Authentication and Identity bounded context.
 *
 * Implements soft deletion via `deleted_at` to preserve referential integrity
 * with historical room membership records.
 *
 * A partial unique index on `email` ensures uniqueness among active (non-deleted)
 * users while allowing the same email to be reused after soft deletion.
 *
 * @see User Aggregate
 * @see IAuthRemoteDataSource
 */
@Entity('users')
@Index('IDX_users_email_active', ['email'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_users_deleted_at', ['deletedAt'])
export class UserOrmEntity {
  /**
   * Universally unique identifier (UUID v4).
   * Generated automatically by PostgreSQL.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * User email — used as the login credential.
   * Must match RFC 5322 format; max 255 characters.
   * Uniqueness enforced via partial index (active users only).
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  email!: string;

  /**
   * Bcrypt hash of the user password.
   * The plaintext password is never stored.
   * Cost factor must be >= 12 (enforced at service level).
   */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  passwordHash!: string;

  /**
   * Display name shown in the UI.
   * Non-empty; max 50 characters.
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  username!: string;

  /**
   * User role determining access level.
   * Defaults to `registered` upon account creation.
   */
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.REGISTERED,
    nullable: false,
  })
  role!: UserRole;

  /**
   * SHA-256 hash of the current refresh token.
   * Used for refresh token rotation and replay detection.
   * NULL when no active session exists.
   */
  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  refreshTokenHash!: string | null;

  /**
   * Account creation timestamp. Set automatically by TypeORM.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Last profile update timestamp. Updated automatically by TypeORM.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Soft-delete timestamp. NULL indicates an active account.
   * Managed by TypeORM's soft-delete mechanism.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
