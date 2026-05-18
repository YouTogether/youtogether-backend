import { UserEntity } from '../../domain/entities/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';

/**
 * Mapper responsible for converting between the ORM persistence model
 * ({@link UserOrmEntity}) and the domain entity ({@link UserEntity}).
 *
 * This is the sole crossing point between the data and domain layers
 * for User data. No other class should perform this conversion.
 *
 * Design notes:
 * - `toDomain` strips infrastructure-only fields (`passwordHash`,
 *   `refreshTokenHash`, `deletedAt`) that the domain layer does not need.
 * - `toOrmEntity` is a partial mapping used when creating or updating
 *   a persistence record from domain data. Fields managed by TypeORM
 *   (timestamps, generated ID) are omitted.
 *
 * @see Flutter equivalent: `UserModel.toDomain()` in the frontend data layer.
 */
export class UserMapper {
  /**
   * Converts an ORM entity (data layer) to a domain entity.
   *
   * @param ormEntity - The TypeORM entity loaded from PostgreSQL.
   * @returns A pure {@link UserEntity} instance for use in domain logic.
   */
  static toDomain(ormEntity: UserOrmEntity): UserEntity {
    return new UserEntity({
      id: ormEntity.id,
      email: ormEntity.email,
      username: ormEntity.username,
      role: ormEntity.role,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
    });
  }

  /**
   * Creates a partial ORM entity from domain data for persistence.
   *
   * This method is used when inserting or updating a user record.
   * Auto-managed fields (id, createdAt, updatedAt, deletedAt) are not
   * set here — TypeORM handles them via decorators.
   *
   * @param params - The fields required to create a user row.
   * @returns A partial {@link UserOrmEntity} ready for repository save.
   */
  static toOrmEntity(params: {
    email: string;
    passwordHash: string;
    username: string;
  }): Partial<UserOrmEntity> {
    return Object.assign(new UserOrmEntity(), {
      email: params.email,
      passwordHash: params.passwordHash,
      username: params.username,
    } satisfies Partial<UserOrmEntity>);
  }
}
