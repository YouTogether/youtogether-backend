import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';

import {
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
  InvalidRefreshTokenFailure,
  UserNotFoundFailure,
} from '../../domain/failures/auth.failure';
import { IAuthRepository } from '../../domain/repositories/auth-repository.interface';
import { AuthResult } from '../../domain/value-objects/auth-result.vo';
import { UserEntity } from '../../domain/entities/user.entity';
import { GetCurrentUserParams } from '../../domain/usecases/get-current-user.params';
import { LoginParams } from '../../domain/usecases/login.params';
import { LogoutParams } from '../../domain/usecases/logout.params';
import { RefreshParams } from '../../domain/usecases/refresh.params';
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
 * Refresh security considerations:
 * - The presented refresh token is first verified cryptographically
 *   (signature + expiration) via {@link TokenService.verifyAndDecodeRefreshToken}.
 *   Any failure at this stage (invalid signature, expired, wrong claim type)
 *   throws {@link InvalidRefreshTokenFailure} without touching the database.
 * - The decoded `sub` claim resolves the associated active user. If the user
 *   is not found, or has no active refresh session (`refreshTokenHash` is
 *   `null` — e.g. after logout), the same failure is thrown.
 * - The presented token's hash is compared against the stored hash. A match
 *   triggers rotation: a new token pair is issued and the stored hash is
 *   overwritten, invalidating the just-used token for any further refresh.
 * - A mismatch indicates the token was already rotated and is being
 *   replayed (e.g. a stolen, previously-valid token). In that case, the
 *   stored hash is cleared entirely — invalidating the *current* legitimate
 *   session as well — forcing the user through a fresh login. This is a
 *   deliberate, conservative response to suspected token theft.
 *
 * Logout: simply clears the stored refresh token hash for the authenticated
 * user. See {@link IAuthRepository.logout} for the full rationale.
 *
 * getCurrentUser: performs a fresh lookup by id among active users, so a
 * client with a cryptographically valid but "orphaned" token (account
 * soft-deleted after issuance) is caught here rather than being trusted
 * blindly. See {@link IAuthRepository.getCurrentUser}.
 *
 * @see IAuthRepository — the domain port being implemented
 * @see TokenService — token generation, verification, and hashing
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

  // --- refresh ---

  /**
   * Rotates a session using a previously issued refresh token.
   *
   * @param params - The presented refresh token.
   * @returns {@link AuthResult} with the user and a freshly rotated token pair.
   * @throws {@link InvalidRefreshTokenFailure} on any validation failure.
   */
  async refresh(params: RefreshParams): Promise<AuthResult> {
    let userId: string;
    try {
      const payload = this.tokenService.verifyAndDecodeRefreshToken(
        params.refreshToken,
      );
      userId = payload.sub;
    } catch {
      throw new InvalidRefreshTokenFailure();
    }

    const ormUser = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });

    if (ormUser === null || ormUser.refreshTokenHash === null) {
      throw new InvalidRefreshTokenFailure();
    }

    const hashMatches = this.tokenService.verifyRefreshToken(
      params.refreshToken,
      ormUser.refreshTokenHash,
    );

    if (!hashMatches) {
      // Replay of an already-rotated token: invalidate the entire session.
      await this.userRepository.update(ormUser.id, { refreshTokenHash: null });
      throw new InvalidRefreshTokenFailure();
    }

    return this.buildAuthResult(ormUser);
  }

  // --- logout ---

  /**
   * Clears the stored refresh token hash for the given user, invalidating
   * their refresh session server-side.
   *
   * No existence check is performed before the update: the caller's id
   * comes from a cryptographically validated access token (via
   * {@link JwtAuthGuard}), and the operation is naturally idempotent —
   * updating a row that no longer matches (already cleared, or the user
   * was deleted between token issuance and this call) simply affects zero
   * rows without error.
   *
   * @param params - The id of the currently authenticated user.
   */
  async logout(params: LogoutParams): Promise<void> {
    await this.userRepository.update(params.userId, {
      refreshTokenHash: null,
    });
  }

  // --- getCurrentUser ---

  /**
   * Retrieves the profile of the currently authenticated user.
   *
   * Unlike logout(), an explicit existence check IS required here: the
   * caller needs the full profile back, so silently returning nothing is
   * not an option. A soft-deleted user (deletedAt not null) is treated
   * identically to a fully unknown id — both throw {@link UserNotFoundFailure}.
   *
   * @param params - The id of the currently authenticated user.
   * @returns The {@link UserEntity} for the active user.
   * @throws {@link UserNotFoundFailure} when no active user matches the id.
   */
  async getCurrentUser(params: GetCurrentUserParams): Promise<UserEntity> {
    const ormUser = await this.userRepository.findOne({
      where: { id: params.userId, deletedAt: IsNull() },
    });

    if (ormUser === null) {
      throw new UserNotFoundFailure();
    }

    return UserMapper.toDomain(ormUser);
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
