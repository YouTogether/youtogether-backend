import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { VideoSessionOrmEntity } from './data/entities/video-session.orm-entity';
import { VideoSessionRepositoryImpl } from './data/repositories/video-session-repository.impl';
import { IVideoSessionRepository } from './domain/repositories/video-session-repository.interface';
import { CreateVideoSessionUseCase } from './domain/usecases/create-video-session.usecase';
import { YouTubeService } from './data/services/youtube.service';
import { VideoSessionController } from './presentation/controllers/video-session.controller';

/**
 * NestJS module for the Video Synchronisation bounded context's
 * persistent (PostgreSQL) side.
 *
 * Use cases registered: {@link CreateVideoSessionUseCase}. Delegates to
 * {@link IVideoSessionRepository} bound to
 * {@link VideoSessionRepositoryImpl}.
 *
 * Imports {@link AuthModule} to reuse {@link JwtAuthGuard}, and
 * {@link RoomModule} to reuse {@link OwnershipGuard} and
 * {@link IRoomRepository} — this bounded context introduces no new
 * ownership logic of its own.
 *
 * Requires the `YOUTUBE_API_KEY` environment variable (see
 * {@link YouTubeService}).
 *
 * Real-time playback synchronisation (play/pause/seek, presence) has no
 * backend module: it is handled entirely by Firebase on the frontend,
 * per the data model's Section 3. This module's scope ends at session
 * creation.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([VideoSessionOrmEntity]),
    AuthModule,
    RoomModule,
  ],
  controllers: [VideoSessionController],
  providers: [
    CreateVideoSessionUseCase,
    YouTubeService,
    {
      provide: IVideoSessionRepository,
      useClass: VideoSessionRepositoryImpl,
    },
  ],
})
export class VideoSyncModule {}
