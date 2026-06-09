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
import { RegisterUseCase } from '../../domain/usecases/register.usecase';
import { RegisterParams } from '../../domain/usecases/register.params';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { LoginDto } from '../dtos/login.dto';
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
 *
 * @see RegisterUseCase
 * @see LoginUseCase
 * @see DomainExceptionFilter
 */
@Controller('auth')
@UseFilters(DomainExceptionFilter)
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
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
