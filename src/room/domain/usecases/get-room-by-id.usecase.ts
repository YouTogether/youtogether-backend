import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { GetRoomByIdParams } from './get-room-by-id.params';
import { RoomEntity } from '../entities/room.entity';

/**
 * Use case for retrieving a single room's details.
 *
 * Orchestrates the lookup by delegating entirely to
 * {@link IRoomRepository.getById}. Contains no business logic beyond
 * delegation — the join against `room_memberships`, the soft-delete
 * filtering, and the "not found" determination are infrastructure
 * concerns handled by the data layer, mirroring `GetCurrentUserUseCase`.
 *
 * Unlike {@link OwnershipGuard} (a presentation-layer authorization
 * pre-check with no business meaning of its own), this use case *is* the
 * business operation "fetch a room" — so a missing room is modeled as a
 * domain failure ({@link RoomNotFoundFailure}) mapped to HTTP by
 * {@link RoomExceptionFilter}, consistent with how `GetCurrentUserUseCase`
 * models a missing user via `UserNotFoundFailure`, rather than as a
 * direct HTTP exception thrown from this layer.
 *
 * @see IRoomRepository.getById — the delegated port method
 */
@Injectable()
export class GetRoomByIdUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the room detail use case.
   *
   * @param params - The id of the room to retrieve.
   * @returns The requested {@link RoomEntity}.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  async execute(params: GetRoomByIdParams): Promise<RoomEntity> {
    return this.roomRepository.getById(params.roomId);
  }
}
