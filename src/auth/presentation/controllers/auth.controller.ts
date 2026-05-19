import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';

import { RegisterUseCase } from '../../domain/usecases/register.usecase';
import { RegisterParams } from '../../domain/usecases/register.params';
import { RegisterResult } from '../../domain/value-objects/register-result.vo';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { RegisterDto } from '../dtos/register.dto';
import { DomainExceptionFilter } from '../filters/domain-exception.filter';

/**
 * Controller for the Authentication bounded context.
 *
 * Maps HTTP routes to domain use cases. This class contains no business
 * logic — it only transforms HTTP input (DTOs) into domain objects
 * (value objects), delegates to use cases, and shapes HTTP responses.
 *
 * The {@link DomainExceptionFilter} is applied at the controller level
 * to translate domain failures into appropriate HTTP status codes without
 * coupling domain classes to HTTP semantics.
 *
 * @see RegisterUseCase
 * @see DomainExceptionFilter
 */
@Controller('auth')
@UseFilters(DomainExceptionFilter)
export class AuthController {
  constructor(private readonly registerUseCase: RegisterUseCase) {}

  /**
   * POST /auth/register
   *
   * Registers a new user account and returns the user profile with an
   * immediately valid token pair, allowing the client to authenticate
   * without a subsequent login request.
   *
   * HTTP status codes:
   * - 201 Created — registration successful.
   * - 400 Bad Request — validation failure (invalid email, short password, etc.).
   * - 409 Conflict — the email address is already registered to an active user.
   *
   * @param dto - Validated registration payload.
   * @returns {@link AuthResponseDto} with user profile and token pair.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const params = new RegisterParams({
      email: dto.email,
      password: dto.password,
      username: dto.username,
    });

    const result = await this.registerUseCase.execute(params);
    return this.toAuthResponse(result);
  }

  /**
   * Maps a {@link RegisterResult} domain value object to an {@link AuthResponseDto}.
   *
   * Extracted as a private typed method to ensure the compiler can fully
   * resolve {@link RegisterResult} at the call site, avoiding the
   * `@typescript-eslint/no-unsafe-assignment` diagnostic that arises when
   * the return type of a decorated injectable method is assigned to an
   * intermediate variable under strict `emitDecoratorMetadata` settings.
   *
   * @param result - The resolved domain result from the use case.
   * @returns A fully shaped HTTP response DTO.
   */
  private toAuthResponse(result: RegisterResult): AuthResponseDto {
    return AuthResponseDto.fromRegisterResult({
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
