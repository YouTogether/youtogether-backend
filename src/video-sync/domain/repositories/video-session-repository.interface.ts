import { VideoSessionEntity } from '../entities/video-session.entity';

/**
 * Metadata resolved from the YouTube Data API v3, needed by the
 * repository to persist a new video session.
 *
 * Kept as a plain interface (rather than importing a data-layer type
 * here) so the domain layer's port has no dependency on how the
 * metadata was actually fetched — mirroring how `IRoomRepository` has
 * no dependency on TypeORM.
 */
export interface VideoMetadata {
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
}

/**
 * Domain port for the Video Synchronisation bounded context's
 * persistent (PostgreSQL) storage.
 *
 * Deliberately narrow: only session creation is exposed for the MVP —
 * there is no `update`, `delete`, or `findAll`, since a video session is
 * an append-only record for the current scope (see the data model's
 * business rules, Section 2.1.4).
 *
 * @see VideoSessionRepositoryImpl
 */
export abstract class IVideoSessionRepository {
  abstract create(
    params: {
      roomId: string;
      youtubeVideoId: string;
      addedBy: string;
    },
    metadata: VideoMetadata,
  ): Promise<VideoSessionEntity>;
}
