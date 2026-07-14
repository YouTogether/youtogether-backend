import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { RoomEntity } from '../entities/room.entity';

/**
 * Use case for listing public rooms.
 *
 * Orchestrates the listing flow by delegating entirely to
 * {@link IRoomRepository.getPublicRooms}. Contains no business logic
 * beyond delegation — the join against `room_memberships` and the
 * public/active filtering are infrastructure concerns handled by the
 * data layer, mirroring `CreateRoomUseCase`.
 *
 * Takes no parameters: listing public rooms requires no caller input
 * beyond the implicit "public, non-deleted" filter, which is not a
 * user-supplied value.
 *
 * @see IRoomRepository.getPublicRooms — the delegated port method
 */
@Injectable()
export class GetPublicRoomsUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the public room listing use case.
   *
   * @returns The list of public, active {@link RoomEntity} instances.
   */
  async execute(): Promise<RoomEntity[]> {
    return this.roomRepository.getPublicRooms();
  }
}
