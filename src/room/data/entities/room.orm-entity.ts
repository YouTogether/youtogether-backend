import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Room entity — aggregate root of the Room bounded context.
 *
 * Implements soft deletion via `deleted_at` to preserve referential
 * integrity with historical `room_memberships` rows, mirroring
 * `UserOrmEntity`.
 */
@Entity('rooms')
@Index('IDX_rooms_owner_id', ['ownerId'])
@Index('IDX_rooms_deleted_at', ['deletedAt'])
export class RoomOrmEntity {
  /**
   * Universally unique identifier (UUID v4).
   * Generated automatically by PostgreSQL.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Public display name of the room.
   * Non-empty; max 100 characters.
   */
  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  /**
   * Optional short description.
   */
  @Column({ type: 'text', nullable: true, default: null })
  description!: string | null;

  /**
   * Identifier of the user who created and owns this room.
   * Only the owner may update or delete the room (enforced by
   * OwnershipGuard).
   */
  @Column({ name: 'owner_id', type: 'uuid', nullable: false })
  ownerId!: string;

  /**
   * Whether the room appears in the public listing.
   * Defaults to true.
   */
  @Column({
    name: 'is_public',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  isPublic!: boolean;

  /**
   * Room creation timestamp. Set automatically by TypeORM.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Last modification timestamp. Updated automatically by TypeORM.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Soft-delete timestamp. NULL indicates an active room.
   * Managed by TypeORM's soft-delete mechanism.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
