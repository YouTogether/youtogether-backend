import { Injectable } from '@nestjs/common';

import { IRoomRepository } from '../repositories/room-repository.interface';
import { CreateRoomParams } from './create-room.params';
import { RoomEntity } from '../entities/room.entity';

/**
 * Use case for room creation.
 *
 * Orchestrates the creation flow by delegating entirely to
 * {@link IRoomRepository.create}. Contains no business logic beyond
 * delegation — the transactional creation of the room and the owner's
 * membership is an infrastructure concern handled by the data layer,
 * mirroring `RegisterUseCase`.
 *
 * @see IRoomRepository.create — the delegated port method
 * @see CreateRoomParams — the input value object
 */
@Injectable()
export class CreateRoomUseCase {
  constructor(private readonly roomRepository: IRoomRepository) {}

  /**
   * Executes the room creation use case.
   *
   * @param params - Validated creation parameters.
   * @returns The created {@link RoomEntity}.
   */
  async execute(params: CreateRoomParams): Promise<RoomEntity> {
    return this.roomRepository.create(params);
  }
}
