import { Injectable } from '@nestjs/common';

import { IVideoSessionRepository } from '../repositories/video-session-repository.interface';
import { VideoSessionEntity } from '../entities/video-session.entity';
import { CreateVideoSessionParams } from './create-video-session.params';
import { InvalidYoutubeVideoIdFailure } from '../failures/video-session.failure';
import { YouTubeService } from '../../data/services/youtube.service';

/**
 * YouTube video id format: 11 characters, letters, digits, `-`, `_`.
 * Duplicated from `CreateVideoSessionDto`'s `@Matches` pattern
 * deliberately (see `InvalidYoutubeVideoIdFailure`'s own doc comment for
 * why this is defense in depth rather than redundancy to remove).
 */
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Orchestrates video session creation: validates the video id format,
 * resolves its metadata via {@link YouTubeService}, and delegates
 * persistence to {@link IVideoSessionRepository}.
 *
 * @competency Evolvable, secure orchestration logic
 */
@Injectable()
export class CreateVideoSessionUseCase {
  constructor(
    private readonly videoSessionRepository: IVideoSessionRepository,
    private readonly youTubeService: YouTubeService,
  ) {}

  async execute(params: CreateVideoSessionParams): Promise<VideoSessionEntity> {
    if (!YOUTUBE_VIDEO_ID_PATTERN.test(params.youtubeVideoId)) {
      throw new InvalidYoutubeVideoIdFailure(params.youtubeVideoId);
    }

    const metadata = await this.youTubeService.fetchMetadata(
      params.youtubeVideoId,
    );

    return this.videoSessionRepository.create(
      {
        roomId: params.roomId,
        youtubeVideoId: params.youtubeVideoId,
        addedBy: params.addedBy,
      },
      metadata,
    );
  }
}
