import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';

import {
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
} from '../../domain/failures/auth.failure';
import { IAuthRepository } from '../../domain/repositories/auth-repository.interface';
import { AuthResult } from '../../domain/value-objects/auth-result.vo';
import { LoginParams } from '../../domain/usecases/login.params';
import { RegisterParams } from '../../domain/usecases/register.params';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserMapper } from '../mappers/user.mapper';
import { TokenService } from '../services/token.service';

/**
 * Data layer implementation of the {@link IAuthRepository} port.
 *
 * Responsibilities:
 * 1. Verify email uniqueness among active (non-deleted) users.
 * 2. Hash the plaintext password using bcrypt (cost factor >= 12).
 * 3. Persist the new user row via TypeORM.
 * 4. Generate a {@link TokenPair} via {@link TokenService}.
 * 5. Store the SHA-256 refresh token hash in `users.refresh_token_hash`.
 * 6. Return a {@link AuthResult} to the use case.
 *
 * Login security considerations:
 * - The user lookup and bcrypt comparison are sequenced so that compare()
 *   is always called, using a static dummy hash when the user is not found.
 *   This ensures response time is consistent regardless of email existence,
 *   mitigating timing-based user enumeration.
 * - Both "user not found" and "wrong password" throw the same
 *   {@link InvalidCredentialsFailure} with an identical generic message,
 *   preventing information leakage (OWASP A07:2021).
 *
 * @see IAuthRepository — the domain port being implemented
 * @see TokenService — token generation and hashing
 * @see UserMapper — ORM <-> domain entity conversion
 * @competency Secure credential validation, timing-safe comparison
 */
@Injectable()
export class AuthRepositoryImpl implements IAuthRepository {
  /** Bcrypt cost factor. OWASP recommends >= 12. */
  private static readonly BCRYPT_COST = 12;

  /**
   * Pre-computed dummy hash used in the constant-time path when no user
   * is found for the given email. Prevents timing attacks that would
   * otherwise reveal whether an email is registered.
   */
  private static readonly DUMMY_HASH =
    '$2b$12$invalidhashusedfortimingprotectionxxxxxxxxxxxxxxxxxxxxxxxx';

  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    private readonly tokenService: TokenService,
  ) {}

  // --- register ---

  /**
   * Registers a new user account.
   *
   * Checks for email collision among active users using the partial unique
   * index semantics (deleted_at IS NULL). On conflict, throws
   * {@link EmailAlreadyInUseFailure} before touching the database.
   *
   * @param params - Validated registration parameters from the use case.
   * @returns {@link AuthResult} containing the persisted user and tokens.
   * @throws {@link EmailAlreadyInUseFailure} on email conflict.
   */
  async register(params: RegisterParams): Promise<AuthResult> {
    const existing = await this.userRepository.findOne({
      where: { email: params.email, deletedAt: IsNull() },
    });

    if (existing !== null) {
      throw new EmailAlreadyInUseFailure(params.email);
    }

    const passwordHash = await bcrypt.hash(
      params.password,
      AuthRepositoryImpl.BCRYPT_COST,
    );

    const ormData = UserMapper.toOrmEntity({
      email: params.email,
      passwordHash,
      username: params.username,
    });

    const savedOrm = await this.userRepository.save(
      this.userRepository.create(ormData),
    );

    return this.buildAuthResult(savedOrm);
  }

  // --- login ---

  /**
   * Authenticates a user with email and password.
   *
   * Timing protection: compare() is always called, even when the user
   * is not found, to ensure a consistent response time regardless of
   * whether the email exists in the database.
   *
   * @param params - Validated login parameters.
   * @returns {@link AuthResult} with the authenticated user and fresh tokens.
   * @throws {@link InvalidCredentialsFailure} on unknown email or wrong password.
   */
  async login(params: LoginParams): Promise<AuthResult> {
    const ormUser = await this.userRepository.findOne({
      where: { email: params.email, deletedAt: IsNull() },
    });

    const hashToCompare =
      ormUser?.passwordHash ?? AuthRepositoryImpl.DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(
      params.password,
      hashToCompare,
    );

    if (ormUser === null || !isPasswordValid) {
      throw new InvalidCredentialsFailure();
    }

    return this.buildAuthResult(ormUser);
  }

  // --- shared helpers ---

  private async buildAuthResult(ormUser: UserOrmEntity): Promise<AuthResult> {
    const userEntity = UserMapper.toDomain(ormUser);

    const tokens = await this.tokenService.generateTokenPair(
      userEntity.id,
      userEntity.role,
    );

    const refreshTokenHash = this.tokenService.hashRefreshToken(
      tokens.refreshToken,
    );

    await this.userRepository.update(ormUser.id, { refreshTokenHash });

    return new AuthResult({ user: userEntity, tokens });
  }
}
