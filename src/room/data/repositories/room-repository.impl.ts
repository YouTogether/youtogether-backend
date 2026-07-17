import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';

import { IRoomRepository } from '../../domain/repositories/room-repository.interface';
import { CreateRoomParams } from '../../domain/usecases/create-room.params';
import { UpdateRoomParams } from '../../domain/usecases/update-room.params';
import { RoomEntity } from '../../domain/entities/room.entity';
import {
  RoomNotFoundFailure,
  RoomAlreadyJoinedFailure,
} from '../../domain/failures/room.failure';
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

  /**
   * Resolves the owner id of a room, for use by {@link OwnershipGuard}.
   *
   * Relies on TypeORM's default soft-delete filtering: since
   * {@link RoomOrmEntity.deletedAt} is a `@DeleteDateColumn`, `findOne`
   * automatically excludes soft-deleted rows without an explicit
   * `deletedAt: IsNull()` clause.
   *
   * @param roomId - The room's id, taken from the route parameter.
   * @returns The owner's user id, or `null` if no active room exists
   *   with this id.
   */
  async findOwnerId(roomId: string): Promise<string | null> {
    const room = await this.dataSource.getRepository(RoomOrmEntity).findOne({
      where: { id: roomId },
      select: ['ownerId'],
    });

    return room?.ownerId ?? null;
  }

  /**
   * Returns every active, public room with its active member count.
   *
   * Joins `rooms` against `room_memberships` restricted to active
   * memberships (`left_at IS NULL`), grouping by room to compute the
   * count. `RoomMembershipOrmEntity` is joined directly (an "entity
   * join") rather than through a TypeORM relation, since neither entity
   * declares `@OneToMany`/`@ManyToOne` decorators — consistent with the
   * rest of this bounded context, which models associations purely
   * through foreign-key columns.
   *
   * `deletedAt IS NULL` is added explicitly: unlike `Repository.find()`,
   * TypeORM's `QueryBuilder` does not automatically exclude soft-deleted
   * rows for `@DeleteDateColumn` entities.
   *
   * @returns Public, active rooms ordered most recently created first.
   */
  async getPublicRooms(): Promise<RoomEntity[]> {
    const { entities, raw } = await this.dataSource
      .getRepository(RoomOrmEntity)
      .createQueryBuilder('room')
      .leftJoin(
        RoomMembershipOrmEntity,
        'membership',
        'membership.roomId = room.id AND membership.leftAt IS NULL',
      )
      .addSelect('COUNT(membership.id)', 'memberCount')
      .where('room.isPublic = :isPublic', { isPublic: true })
      .andWhere('room.deletedAt IS NULL')
      .groupBy('room.id')
      .orderBy('room.createdAt', 'DESC')
      .getRawAndEntities<{ memberCount: string }>();

    return entities.map((room, index) =>
      RoomMapper.toDomain(room, parseInt(raw[index].memberCount, 10)),
    );
  }

  /**
   * Retrieves a single active, public-or-private room by id, with its
   * current active member count.
   *
   * No `isPublic` filter is applied here (unlike {@link getPublicRooms}):
   * this method backs the room detail endpoint, which — per this task's
   * Definition of Done — only distinguishes "exists and active" (200)
   * from "missing or soft-deleted" (404). Restricting private-room detail
   * access to members only is not a stated requirement at this stage and
   * is left as a follow-up if a future task introduces that constraint.
   *
   * @param roomId - The room's id.
   * @returns The requested {@link RoomEntity}.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  async getById(roomId: string): Promise<RoomEntity> {
    const { entities, raw } = await this.dataSource
      .getRepository(RoomOrmEntity)
      .createQueryBuilder('room')
      .leftJoin(
        RoomMembershipOrmEntity,
        'membership',
        'membership.roomId = room.id AND membership.leftAt IS NULL',
      )
      .addSelect('COUNT(membership.id)', 'memberCount')
      .where('room.id = :roomId', { roomId })
      .andWhere('room.deletedAt IS NULL')
      .groupBy('room.id')
      .getRawAndEntities<{ memberCount: string }>();

    if (entities.length === 0) {
      throw new RoomNotFoundFailure(roomId);
    }

    return RoomMapper.toDomain(entities[0], parseInt(raw[0].memberCount, 10));
  }

  /**
   * Updates a room's name and/or description, then returns it with a
   * freshly computed active member count.
   *
   * Ownership is not re-checked here — see {@link IRoomRepository.update}.
   * Loads the row via `findOne` (which excludes soft-deleted rows by
   * TypeORM's default behavior for `@DeleteDateColumn` entities, unlike
   * the explicit `deletedAt IS NULL` needed in `QueryBuilder` methods),
   * applies only the fields actually provided (`undefined` means "leave
   * unchanged"), and saves — `updatedAt` is refreshed automatically by
   * TypeORM's `@UpdateDateColumn` on `save()`.
   *
   * @param params - The room id and the fields to update (partial).
   * @returns The updated {@link RoomEntity}.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  async update(params: UpdateRoomParams): Promise<RoomEntity> {
    const roomRepository = this.dataSource.getRepository(RoomOrmEntity);
    const room = await roomRepository.findOne({
      where: { id: params.roomId },
    });

    if (room === null) {
      throw new RoomNotFoundFailure(params.roomId);
    }

    if (params.name !== undefined) {
      room.name = params.name;
    }
    if (params.description !== undefined) {
      room.description = params.description;
    }

    const savedRoom = await roomRepository.save(room);

    const memberCount = await this.dataSource
      .getRepository(RoomMembershipOrmEntity)
      .count({ where: { roomId: savedRoom.id, leftAt: IsNull() } });

    return RoomMapper.toDomain(savedRoom, memberCount);
  }

  /**
   * Soft-deletes a room via TypeORM's `softDelete`, which sets
   * `deleted_at` to the current timestamp rather than removing the row —
   * `room_memberships` rows referencing this room are left untouched,
   * preserving.
   *
   * `softDelete` silently affects zero rows for a non-existent or
   * already-deleted id rather than throwing; `affected` is checked
   * explicitly to surface that case as {@link RoomNotFoundFailure}.
   *
   * @param roomId - The room's id.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  async delete(roomId: string): Promise<void> {
    const result = await this.dataSource
      .getRepository(RoomOrmEntity)
      .softDelete(roomId);

    if (result.affected === 0) {
      throw new RoomNotFoundFailure(roomId);
    }
  }

  /**
   * Creates an active membership for a user in a room.
   *
   * Defense in depth against the race window between the pre-check and
   * the insert: a pre-check against an existing active membership gives
   * a clean, predictable 409 in the common case, while the
   * `try`/`catch` around the insert falls back to translating a
   * genuine unique-constraint violation (Postgres error code `23505`,
   * from `IDX_room_memberships_active_unique`) into the same
   * {@link RoomAlreadyJoinedFailure} if two requests race each other.
   * Any other database error is rethrown unchanged.
   *
   * @param roomId - The room's id.
   * @param userId - The joining user's id.
   * @returns The room, with a freshly computed active member count.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   * @throws {@link RoomAlreadyJoinedFailure} if the user already holds an
   *   active membership in this room.
   */
  async join(roomId: string, userId: string): Promise<RoomEntity> {
    const room = await this.dataSource
      .getRepository(RoomOrmEntity)
      .findOne({ where: { id: roomId } });

    if (room === null) {
      throw new RoomNotFoundFailure(roomId);
    }

    const membershipRepository = this.dataSource.getRepository(
      RoomMembershipOrmEntity,
    );

    const existingActiveMembership = await membershipRepository.findOne({
      where: { roomId, userId, leftAt: IsNull() },
    });

    if (existingActiveMembership !== null) {
      throw new RoomAlreadyJoinedFailure(roomId, userId);
    }

    try {
      const membership = membershipRepository.create({ roomId, userId });
      await membershipRepository.save(membership);
    } catch (error) {
      if (RoomRepositoryImpl.isUniqueViolation(error)) {
        throw new RoomAlreadyJoinedFailure(roomId, userId);
      }
      throw error;
    }

    const memberCount = await membershipRepository.count({
      where: { roomId, leftAt: IsNull() },
    });

    return RoomMapper.toDomain(room, memberCount);
  }

  /**
   * Checks whether a caught error is a PostgreSQL unique constraint
   * violation (SQLSTATE `23505`), without depending on `pg`'s error
   * class directly (TypeORM does not consistently re-export it across
   * drivers).
   */
  private static isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === '23505'
    );
  }
}
