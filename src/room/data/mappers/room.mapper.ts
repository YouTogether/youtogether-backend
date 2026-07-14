import { RoomEntity } from '../../domain/entities/room.entity';
import { RoomOrmEntity } from '../entities/room.orm-entity';

/**
 * Mapper responsible for converting between the ORM persistence model
 * ({@link RoomOrmEntity}) and the domain entity ({@link RoomEntity}).
 *
 * This is the sole crossing point between the data and domain layers for
 * Room data, mirroring `UserMapper`.
 *
 * Design notes:
 * - `toDomain` strips the infrastructure-only `deletedAt` field.
 * - `memberCount` is not present on `RoomOrmEntity` (it is a computed
 *   projection, not a persisted column) and must be supplied explicitly
 *   by the caller, who already knows it from the context of the query
 *   (1 immediately after `create()`; a joined COUNT for listing/detail
 *   queries in later tasks).
 */
export class RoomMapper {
  /**
   * Converts an ORM entity (data layer) to a domain entity.
   *
   * @param ormEntity - The TypeORM entity loaded from PostgreSQL.
   * @param memberCount - The active member count computed by the caller.
   * @returns A pure {@link RoomEntity} instance for use in domain logic.
   */
  static toDomain(ormEntity: RoomOrmEntity, memberCount: number): RoomEntity {
    return new RoomEntity({
      id: ormEntity.id,
      name: ormEntity.name,
      description: ormEntity.description,
      ownerId: ormEntity.ownerId,
      isPublic: ormEntity.isPublic,
      memberCount,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
    });
  }
}
