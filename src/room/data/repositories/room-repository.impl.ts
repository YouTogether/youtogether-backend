import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IRoomRepository } from '../../domain/repositories/room-repository.interface';
import { CreateRoomParams } from '../../domain/usecases/create-room.params';
import { RoomEntity } from '../../domain/entities/room.entity';
import { RoomMapper } from '../mappers/room.mapper';
import { RoomOrmEntity } from '../entities/room.orm-entity';
import { RoomMembershipOrmEntity } from '../entities/room-membership.orm-entity';

/**
 * Data layer implementation of {@link IRoomRepository}.
 *
 * @see IRoomRepository — the domain port being implemented
 * @see RoomMapper — ORM <-> domain entity conversion
 * @competency Evolvable, secured code (transactional consistency)
 */
@Injectable()
export class RoomRepositoryImpl implements IRoomRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a room and auto-joins its owner as the first active member.
   *
   * Both inserts happen within a single database transaction: a room
   * without its owner's membership (or vice versa) would violate the
   * invariant that every room has at least one active member (its
   * owner) from the moment it exists — a partial write here would leave
   * the aggregate in an inconsistent state.
   *
   * @param params - Validated creation parameters.
   * @returns The persisted {@link RoomEntity}, with `memberCount` set to 1.
   */
  async create(params: CreateRoomParams): Promise<RoomEntity> {
    return this.dataSource.transaction(async (manager) => {
      const room = manager.create(RoomOrmEntity, {
        name: params.name,
        description: params.description,
        ownerId: params.ownerId,
        isPublic: params.isPublic,
      });
      const savedRoom = await manager.save(RoomOrmEntity, room);

      const membership = manager.create(RoomMembershipOrmEntity, {
        roomId: savedRoom.id,
        userId: params.ownerId,
      });
      await manager.save(RoomMembershipOrmEntity, membership);

      return RoomMapper.toDomain(savedRoom, 1);
    });
  }
}
