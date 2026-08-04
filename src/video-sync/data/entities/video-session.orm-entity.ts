import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * VideoSession entity — aggregate root of the Video Synchronisation
 * bounded context's persistent (PostgreSQL) side.
 *
 * Caches YouTube metadata at insertion time (title, thumbnail,
 * duration). Holds no playback state: is_playing / timestamp_seconds /
 * leader_id live exclusively in Firebase (see the domain entity's own
 * doc comment for the split), mirroring how `RoomOrmEntity` holds no
 * presence data.
 *
 * @see CreateVideoSessionsTable1785600000000
 */
@Entity('video_sessions')
@Index('IDX_video_sessions_room_id', ['roomId'])
export class VideoSessionOrmEntity {
  /**
   * Universally unique identifier (UUID v4).
   * Generated automatically by PostgreSQL.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Room this video session belongs to.
   */
  @Column({ name: 'room_id', type: 'uuid', nullable: false })
  roomId!: string;

  /**
   * YouTube video identifier (11 characters: letters, digits, `-`, `_`).
   * Format enforced both here (application-level DTO validation) and at
   * the database level (CHECK constraint), following the same
   * defence-in-depth pattern as `RoomOrmEntity.name`.
   */
  @Column({ name: 'youtube_video_id', type: 'varchar', length: 20 })
  youtubeVideoId!: string;

  /**
   * Video title, cached from the YouTube Data API v3 at session
   * creation. Not kept in sync with YouTube afterwards.
   */
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  /**
   * Thumbnail URL, cached from the YouTube Data API v3. Nullable: some
   * videos or API responses may omit a thumbnail.
   */
  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  thumbnailUrl!: string | null;

  /**
   * Total video duration in seconds, parsed from the YouTube Data API's
   * ISO 8601 duration format at session creation.
   */
  @Column({ name: 'duration_seconds', type: 'int' })
  durationSeconds!: number;

  /**
   * User who added this video session. Must be the room's owner for the
   * MVP (enforced by OwnershipGuard at the controller, not by a
   * database-level constraint, since ownership can change independently
   * of this row in a future iteration).
   */
  @Column({ name: 'added_by', type: 'uuid' })
  addedBy!: string;

  /**
   * Session creation timestamp. Set automatically by TypeORM.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
