import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * RoomMembership entity — child entity within the Room aggregate boundary.
 *
 * Tracks which users have joined a room. A user may hold at most one
 * *active* membership (`left_at IS NULL`) per room, enforced by the
 * partial unique index created in the `CreateRoomsTable` migration
 * — not by a TypeORM decorator, since TypeORM's `@Unique`
 * cannot express a partial (`WHERE`) constraint.
 *
 * @see CreateRoomsTable1784015715536 — IDX_room_memberships_active_unique
 */
@Entity('room_memberships')
@Index('IDX_room_memberships_room_id', ['roomId'])
@Index('IDX_room_memberships_user_id', ['userId'])
export class RoomMembershipOrmEntity {
  /**
   * Universally unique identifier (UUID v4).
   * Generated automatically by PostgreSQL.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Room this membership belongs to.
   */
  @Column({ name: 'room_id', type: 'uuid', nullable: false })
  roomId!: string;

  /**
   * User holding this membership.
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  /**
   * Timestamp of the join action. Set automatically by TypeORM.
   */
  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  /**
   * Timestamp when the user left. NULL indicates an active membership.
   * Set explicitly by `RoomRepositoryImpl.leave()`;
   * always NULL for a membership created by `create()`.
   */
  @Column({
    name: 'left_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  leftAt!: Date | null;
}
