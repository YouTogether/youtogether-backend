import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';

import { LoginUseCase } from '../../domain/usecases/login.usecase';
import { LoginParams } from '../../domain/usecases/login.params';
import { RefreshUseCase } from '../../domain/usecases/refresh.usecase';
import { RefreshParams } from '../../domain/usecases/refresh.params';
import { RegisterUseCase } from '../../domain/usecases/register.usecase';
import { RegisterParams } from '../../domain/usecases/register.params';
import { AuthResult } from '../../domain/value-objects/auth-result.vo';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { LoginDto } from '../dtos/login.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { RegisterDto } from '../dtos/register.dto';
import { DomainExceptionFilter } from '../filters/domain-exception.filter';

/**
 * Controller for the Authentication bounded context.
 *
 * Maps HTTP routes to domain use cases. Contains no business logic:
 * it transforms HTTP input (DTOs) into domain value objects, delegates
 * to use cases, and shapes HTTP responses.
 *
 * The {@link DomainExceptionFilter} translates domain failures to HTTP
 * status codes without coupling domain classes to HTTP semantics.
 *
 * Routes:
 * - POST /auth/register -> {@link RegisterUseCase}
 * - POST /auth/login    -> {@link LoginUseCase}
 * - POST /auth/refresh  -> {@link RefreshUseCase}
 *
 * @see RegisterUseCase
 * @see LoginUseCase
 * @see RefreshUseCase
 * @see DomainExceptionFilter
 */
@Controller('auth')
@UseFilters(DomainExceptionFilter)
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
  ) {}

  /**
   * POST /auth/register
   *
   * Registers a new user and returns the profile with a fresh token pair.
   *
   * HTTP status codes:
   * - 201 Created       — registration successful.
   * - 400 Bad Request   — validation failure.
   * - 409 Conflict      — email already registered.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.registerUseCase.execute(
      new RegisterParams({
        email: dto.email,
        password: dto.password,
        username: dto.username,
      }),
    );

    return this.toResponse(result);
  }

  /**
   * POST /auth/login
   *
   * Authenticates an existing user and returns the profile with a fresh token pair.
   *
   * HTTP status codes:
   * - 200 OK             — authentication successful.
   * - 400 Bad Request    — validation failure (missing/invalid fields).
   * - 401 Unauthorized   — invalid credentials (generic message, no field detail).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.loginUseCase.execute(
      new LoginParams({
        email: dto.email,
        password: dto.password,
      }),
    );

    return this.toResponse(result);
  }

  /**
   * POST /auth/refresh
   *
   * Rotates the session: validates the presented refresh token, issues a
   * new access/refresh pair, and invalidates the presented token for any
   * further use.
   *
   * HTTP status codes:
   * - 200 OK           — rotation successful, new token pair returned.
   * - 400 Bad Request  — malformed token (fails JWT structural validation).
   * - 401 Unauthorized — invalid, expired, or already-used (replayed) token.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const result = await this.refreshUseCase.execute(
      new RefreshParams({ refreshToken: dto.refreshToken }),
    );

    return this.toResponse(result);
  }

  /**
   * Shapes the shared {@link AuthResponseDto} from an {@link AuthResult}.
   * Used by all three routes to avoid duplicating the mapping logic.
   */
  private toResponse(result: AuthResult): AuthResponseDto {
    return AuthResponseDto.fromAuthResult({
      id: result.user.id,
      email: result.user.email,
      username: result.user.username,
      role: result.user.role,
      createdAt: result.user.createdAt,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  }
}
