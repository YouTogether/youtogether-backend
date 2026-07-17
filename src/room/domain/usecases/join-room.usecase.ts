import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { JoinRoomParams } from './join-room.params';
import { RoomEntity } from '../entities/room.entity';

/**
 * Use case for a user joining a room.
 *
 * Orchestrates the join by delegating entirely to
 * {@link IRoomRepository.join}. Contains no business logic beyond
 * delegation — existence checking, duplicate-active-membership
 * detection, and the member count refresh are infrastructure concerns
 * handled by the data layer, mirroring `UpdateRoomUseCase`.
 *
 * @see IRoomRepository.join — the delegated port method
 */
@Injectable()
export class JoinRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the join-room use case.
   *
   * @param params - The room id and the joining user's id.
   * @returns The room, with a freshly computed active member count.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   * @throws {@link RoomAlreadyJoinedFailure} if the user already holds an
   *   active membership in this room.
   */
  async execute(params: JoinRoomParams): Promise<RoomEntity> {
    return this.roomRepository.join(params.roomId, params.userId);
  }
}
