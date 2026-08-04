import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  IVideoSessionRepository,
  VideoMetadata,
} from '../../domain/repositories/video-session-repository.interface';
import { VideoSessionEntity } from '../../domain/entities/video-session.entity';
import { VideoSessionMapper } from '../mappers/video-session.mapper';
import { VideoSessionOrmEntity } from '../entities/video-session.orm-entity';

/**
 * Data layer implementation of {@link IVideoSessionRepository}.
 *
 * @see IVideoSessionRepository — the domain port being implemented
 * @see VideoSessionMapper — ORM <-> domain entity conversion
 */
@Injectable()
export class VideoSessionRepositoryImpl implements IVideoSessionRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Persists a video session with metadata already resolved by
   * {@link YouTubeService}.
   *
   * Metadata is passed in rather than fetched here, keeping this
   * repository solely responsible for persistence — mirroring how
   * `RoomRepositoryImpl.create` receives already-validated params
   * rather than performing validation itself.
   */
  async create(
    params: { roomId: string; youtubeVideoId: string; addedBy: string },
    metadata: VideoMetadata,
  ): Promise<VideoSessionEntity> {
    const repository = this.dataSource.getRepository(VideoSessionOrmEntity);
    const entity = repository.create({
      roomId: params.roomId,
      youtubeVideoId: params.youtubeVideoId,
      addedBy: params.addedBy,
      title: metadata.title,
      thumbnailUrl: metadata.thumbnailUrl,
      durationSeconds: metadata.durationSeconds,
    });
    const saved = await repository.save(entity);
    return VideoSessionMapper.toDomain(saved);
  }
}
