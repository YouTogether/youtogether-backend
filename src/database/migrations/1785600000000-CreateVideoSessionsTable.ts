import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `video_sessions` table — the persistent (PostgreSQL) side
 * of the Video Synchronisation bounded context.
 *
 * `video_sessions` caches YouTube metadata (title, thumbnail, duration)
 * at insertion time. It does not
 * hold any playback state: ephemeral synchronization data lives
 * exclusively in Firebase Realtime Database.
 *
 * Foreign keys cascade on delete: deleting a room or a user removes the
 * video sessions that reference them, since a video session has no
 * independent meaning outside its room.
 *
 * @competency Evolvable, secure schema design
 */
export class CreateVideoSessionsTable1785600000000 implements MigrationInterface {
  name = 'CreateVideoSessionsTable1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_sessions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "room_id" UUID NOT NULL,
        "youtube_video_id" VARCHAR(20) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "thumbnail_url" VARCHAR(512),
        "duration_seconds" INTEGER NOT NULL,
        "added_by" UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_video_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_video_sessions_youtube_video_id_format"
          CHECK ("youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$'),
        CONSTRAINT "CHK_video_sessions_duration_seconds_positive"
          CHECK ("duration_seconds" > 0),
        CONSTRAINT "FK_video_sessions_room_id" FOREIGN KEY ("room_id")
          REFERENCES "rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_video_sessions_added_by" FOREIGN KEY ("added_by")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_video_sessions_room_id"
        ON "video_sessions" ("room_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_video_sessions_room_id";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "video_sessions" CASCADE;`);
  }
}
