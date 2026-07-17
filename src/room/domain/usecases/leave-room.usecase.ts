import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { LeaveRoomParams } from './leave-room.params';

/**
 * Use case for a user leaving a room.
 *
 * Orchestrates the departure by delegating entirely to
 * {@link IRoomRepository.leave}. Contains no business logic beyond
 * delegation — the owner-cannot-leave invariant and the "no active
 * membership" determination are infrastructure concerns handled by the
 * data layer, mirroring `JoinRoomUseCase`.
 *
 * @see IRoomRepository.leave — the delegated port method
 */
@Injectable()
export class LeaveRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the leave-room use case.
   *
   * @param params - The room id and the leaving user's id.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   * @throws {@link RoomOwnerCannotLeaveFailure} if the user is the room's owner.
   * @throws {@link RoomMembershipNotFoundFailure} if the user holds no
   *   active membership in this room.
   */
  async execute(params: LeaveRoomParams): Promise<void> {
    return this.roomRepository.leave(params.roomId, params.userId);
  }
}
