import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RoomOrmEntity } from './data/entities/room.orm-entity';
import { RoomMembershipOrmEntity } from './data/entities/room-membership.orm-entity';
import { RoomRepositoryImpl } from './data/repositories/room-repository.impl';
import { IRoomRepository } from './domain/repositories/room-repository.interface';
import { CreateRoomUseCase } from './domain/usecases/create-room.usecase';
import { GetPublicRoomsUseCase } from './domain/usecases/get-public-rooms.usecase';
import { GetRoomByIdUseCase } from './domain/usecases/get-room-by-id.usecase';
import { UpdateRoomUseCase } from './domain/usecases/update-room.usecase';
import { DeleteRoomUseCase } from './domain/usecases/delete-room.usecase';
import { JoinRoomUseCase } from './domain/usecases/join-room.usecase';
import { LeaveRoomUseCase } from './domain/usecases/leave-room.usecase';
import { OwnershipGuard } from './presentation/guards/ownership.guard';
import { RoomController } from './presentation/controllers/room.controller';

/**
 * NestJS module for the Room bounded context.
 *
 * Use cases registered: {@link CreateRoomUseCase}. Delegates to
 * {@link IRoomRepository} bound to {@link RoomRepositoryImpl}.
 *
 * Imports {@link AuthModule} to reuse its exported {@link JwtAuthGuard}
 * and `PassportModule` registration, rather than redefining
 * authentication for this module.
 *
 * Exports {@link OwnershipGuard} and {@link IRoomRepository} so that
 * `VideoSyncModule` can reuse the same owner-only access control on
 * `POST /rooms/:id/video-session` (B-V01-T3) rather than duplicating
 * it — a video session's ownership rule is identical to a room's own
 * update/delete rule, both keyed off `rooms.owner_id`.
 *
 * Grows incrementally as backend tasks progress.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RoomOrmEntity, RoomMembershipOrmEntity]),
    AuthModule,
  ],
  controllers: [RoomController],
  providers: [
    CreateRoomUseCase,
    GetPublicRoomsUseCase,
    GetRoomByIdUseCase,
    UpdateRoomUseCase,
    DeleteRoomUseCase,
    JoinRoomUseCase,
    LeaveRoomUseCase,
    OwnershipGuard,
    {
      provide: IRoomRepository,
      useClass: RoomRepositoryImpl,
    },
  ],
  exports: [OwnershipGuard, IRoomRepository],
})
export class RoomModule {}
