import { VideoSessionEntity } from '../../domain/entities/video-session.entity';
import { VideoSessionOrmEntity } from '../entities/video-session.orm-entity';

/**
 * Mapper responsible for converting between the ORM persistence model
 * ({@link VideoSessionOrmEntity}) and the domain entity
 * ({@link VideoSessionEntity}).
 *
 * The sole crossing point between the data and domain layers for
 * VideoSession data, mirroring `RoomMapper`.
 */
export class VideoSessionMapper {
  static toDomain(ormEntity: VideoSessionOrmEntity): VideoSessionEntity {
    return new VideoSessionEntity({
      id: ormEntity.id,
      roomId: ormEntity.roomId,
      youtubeVideoId: ormEntity.youtubeVideoId,
      title: ormEntity.title,
      thumbnailUrl: ormEntity.thumbnailUrl,
      durationSeconds: ormEntity.durationSeconds,
      addedBy: ormEntity.addedBy,
      createdAt: ormEntity.createdAt,
    });
  }
}
