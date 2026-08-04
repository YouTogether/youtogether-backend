import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { VideoSessionEntity } from '../../domain/entities/video-session.entity';

/**
 * Shapes a {@link VideoSessionEntity} for the HTTP response, mirroring
 * `RoomResponseDto`.
 */
export class VideoSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  roomId!: string;

  @ApiProperty()
  youtubeVideoId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl!: string | null;

  @ApiProperty()
  durationSeconds!: number;

  @ApiProperty()
  addedBy!: string;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(entity: VideoSessionEntity): VideoSessionResponseDto {
    const dto = new VideoSessionResponseDto();
    dto.id = entity.id;
    dto.roomId = entity.roomId;
    dto.youtubeVideoId = entity.youtubeVideoId;
    dto.title = entity.title;
    dto.thumbnailUrl = entity.thumbnailUrl;
    dto.durationSeconds = entity.durationSeconds;
    dto.addedBy = entity.addedBy;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
