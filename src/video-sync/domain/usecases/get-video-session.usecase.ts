import { Injectable } from '@nestjs/common';

import { IVideoSessionRepository } from '../repositories/video-session-repository.interface';
import { VideoSessionEntity } from '../entities/video-session.entity';
import { VideoSessionNotFoundFailure } from '../failures/video-session.failure';

/**
 * Retrieves the current video session for a room.
 *
 * A thin orchestrator, mirroring `GetRoomByIdUseCase`: delegates
 * directly to {@link IVideoSessionRepository.findByRoomId} and converts
 * a `null` result into {@link VideoSessionNotFoundFailure}, so the
 * controller layer only ever deals with a resolved entity or a thrown
 * failure — never a nullable return value.
 *
 * @see B-V02
 * @competency Evolvable orchestration logic (C2.2.1, C2.2.3)
 */
@Injectable()
export class GetVideoSessionUseCase {
  constructor(
    private readonly videoSessionRepository: IVideoSessionRepository,
  ) {}

  async execute(roomId: string): Promise<VideoSessionEntity> {
    const session = await this.videoSessionRepository.findByRoomId(roomId);

    if (session === null) {
      throw new VideoSessionNotFoundFailure(roomId);
    }

    return session;
  }
}
