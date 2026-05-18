import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';

import { EmailAlreadyInUseFailure } from '../../domain/failures/auth.failure';
import { IAuthRepository } from '../../domain/repositories/auth-repository.interface';
import { RegisterParams } from '../../domain/usecases/register.params';
import { RegisterResult } from '../../domain/value-objects/register-result.vo';
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
 * 6. Return a {@link RegisterResult} to the use case.
 *
 * @see IAuthRepository — the domain port being implemented
 * @see TokenService — token generation and hashing
 * @see UserMapper — ORM ↔ domain entity conversion
 * @competency Secure password storage (OWASP A02:2021)
 */
@Injectable()
export class AuthRepositoryImpl implements IAuthRepository {
  /** Bcrypt cost factor. OWASP recommends >= 12. */
  private static readonly BCRYPT_COST = 12;

  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Registers a new user account.
   *
   * Checks for email collision among active users using the partial unique
   * index semantics (deleted_at IS NULL). On conflict, throws
   * {@link EmailAlreadyInUseFailure} before touching the database.
   *
   * @param params - Validated registration parameters from the use case.
   * @returns {@link RegisterResult} containing the persisted user and tokens.
   * @throws {@link EmailAlreadyInUseFailure} on email conflict.
   */
  async register(params: RegisterParams): Promise<RegisterResult> {
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

    const userEntity = UserMapper.toDomain(savedOrm);

    const tokens = await this.tokenService.generateTokenPair(
      userEntity.id,
      userEntity.role,
    );

    const refreshTokenHash = this.tokenService.hashRefreshToken(
      tokens.refreshToken,
    );

    await this.userRepository.update(savedOrm.id, { refreshTokenHash });

    return new RegisterResult({ user: userEntity, tokens });
  }
}
