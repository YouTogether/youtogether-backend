import { UserRole } from '../enums/user-role.enum';

/**
 * Domain entity representing a User in the Authentication bounded context.
 *
 * This class is the aggregate root for identity and credentials. It is a
 * plain TypeScript object with no ORM decorators, no framework imports,
 * and no infrastructure concerns. It can be instantiated and tested without
 * any external dependency.
 *
 * The data layer provides a mapper ({@link UserMapper}) to convert between
 * this domain entity and the TypeORM ORM entity used for persistence.
 */
export class UserEntity {
  /** Universally unique identifier (UUID v4). */
  readonly id: string;

  /** User email — used as the login credential. */
  readonly email: string;

  /** Display name shown in the UI. */
  readonly username: string;

  /** User role determining access level. */
  readonly role: UserRole;

  /** Account creation timestamp. */
  readonly createdAt: Date;

  /** Last profile update timestamp. */
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.email = params.email;
    this.username = params.username;
    this.role = params.role;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
