import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { RoomModule } from '../room/room.module';
import { VideoSessionOrmEntity } from './data/entities/video-session.orm-entity';
import { VideoSessionRepositoryImpl } from './data/repositories/video-session-repository.impl';
import { IVideoSessionRepository } from './domain/repositories/video-session-repository.interface';
import { IRealtimeStateWriter } from './domain/repositories/realtime-state-writer.interface';
import { CreateVideoSessionUseCase } from './domain/usecases/create-video-session.usecase';
import { GetVideoSessionUseCase } from './domain/usecases/get-video-session.usecase';
import { FirebaseRealtimeStateService } from './data/services/firebase-realtime-state.service';
import { YouTubeService } from './data/services/youtube.service';
import { VideoSessionController } from './presentation/controllers/video-session.controller';

/**
 * NestJS module for the Video Synchronisation bounded context's
 * persistent (PostgreSQL) side, plus the single authoritative write it
 * makes to the real-time store.
 *
 * Use cases registered: {@link CreateVideoSessionUseCase},
 * {@link GetVideoSessionUseCase} Delegates to
 * {@link IVideoSessionRepository} bound to
 * {@link VideoSessionRepositoryImpl}, and to
 * {@link IRealtimeStateWriter} bound to
 * {@link FirebaseRealtimeStateService}.
 *
 * Imports {@link AuthModule} to reuse {@link JwtAuthGuard},
 * {@link RoomModule} to reuse {@link OwnershipGuard} and
 * {@link IRoomRepository} — this bounded context introduces no new
 * ownership logic of its own — and {@link FirebaseModule} for the
 * shared Admin SDK handle.
 *
 * Requires the `YOUTUBE_API_KEY` environment variable (see
 * {@link YouTubeService}) and the four `FIREBASE_*` variables (see
 * {@link FirebaseAdminService}).
 *
 * Ongoing real-time playback synchronisation (play/pause/seek,
 * presence, the ready gate) still has no backend module: it is handled
 * entirely by Firebase on the frontend, per the data model's Section 3.
 * The only exception is the creation of the `playback_state` node,
 * which the backend owns because it carries `leader_id` — see
 * {@link IRealtimeStateWriter} for the full rationale.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([VideoSessionOrmEntity]),
    AuthModule,
    RoomModule,
    FirebaseModule,
  ],
  controllers: [VideoSessionController],
  providers: [
    CreateVideoSessionUseCase,
    GetVideoSessionUseCase,
    YouTubeService,
    {
      provide: IVideoSessionRepository,
      useClass: VideoSessionRepositoryImpl,
    },
    {
      provide: IRealtimeStateWriter,
      useClass: FirebaseRealtimeStateService,
    },
  ],
})
export class VideoSyncModule {}
