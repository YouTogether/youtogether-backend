import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { DeleteRoomParams } from './delete-room.params';

/**
 * Use case for soft-deleting a room.
 *
 * Orchestrates the deletion by delegating entirely to
 * {@link IRoomRepository.delete}. Contains no business logic beyond
 * delegation, mirroring `UpdateRoomUseCase`.
 *
 * Ownership authorization is deliberately **not** this use case's
 * concern: by the time the controller calls `execute()`, `OwnershipGuard`
 * has already confirmed the requester owns the room (see
 * `RoomController.remove`).
 *
 * @see IRoomRepository.delete — the delegated port method
 */
@Injectable()
export class DeleteRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the room deletion use case.
   *
   * @param params - The id of the room to delete.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  async execute(params: DeleteRoomParams): Promise<void> {
    return this.roomRepository.delete(params.roomId);
  }
}
