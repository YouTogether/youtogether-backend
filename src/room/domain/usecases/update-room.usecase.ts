import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { UpdateRoomParams } from './update-room.params';
import { RoomEntity } from '../entities/room.entity';

/**
 * Use case for updating a room's name and/or description.
 *
 * Orchestrates the update by delegating entirely to
 * {@link IRoomRepository.update}. Contains no business logic beyond
 * delegation — partial-field application and the "not found"
 * determination are infrastructure concerns handled by the data layer,
 * mirroring `CreateRoomUseCase`.
 *
 * Ownership authorization is deliberately **not** this use case's
 * concern: by the time the controller calls `execute()`, `OwnershipGuard`
 * has already confirmed the requester owns the room (see
 * `RoomController.update`). This use case would run the same way if
 * called from anywhere the caller had already been authorized.
 *
 * @see IRoomRepository.update — the delegated port method
 */
@Injectable()
export class UpdateRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the room update use case.
   *
   * @param params - The room id and the fields to update.
   * @returns The updated {@link RoomEntity}.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  async execute(params: UpdateRoomParams): Promise<RoomEntity> {
    return this.roomRepository.update(params);
  }
}
