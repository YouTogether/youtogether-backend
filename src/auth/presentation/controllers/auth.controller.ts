import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { GetCurrentUserUseCase } from '../../domain/usecases/get-current-user.usecase';
import { GetCurrentUserParams } from '../../domain/usecases/get-current-user.params';
import { LoginUseCase } from '../../domain/usecases/login.usecase';
import { LoginParams } from '../../domain/usecases/login.params';
import { LogoutUseCase } from '../../domain/usecases/logout.usecase';
import { LogoutParams } from '../../domain/usecases/logout.params';
import { RefreshUseCase } from '../../domain/usecases/refresh.usecase';
import { RefreshParams } from '../../domain/usecases/refresh.params';
import { RegisterUseCase } from '../../domain/usecases/register.usecase';
import { RegisterParams } from '../../domain/usecases/register.params';
import { AuthResult } from '../../domain/value-objects/auth-result.vo';
import { AuthResponseDto, UserProfileDto } from '../dtos/auth-response.dto';
import { LoginDto } from '../dtos/login.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { RegisterDto } from '../dtos/register.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DomainExceptionFilter } from '../filters/domain-exception.filter';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

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
 * - POST /auth/logout   -> {@link LogoutUseCase} (protected by {@link JwtAuthGuard})
 * - GET  /auth/me        -> {@link GetCurrentUserUseCase} (protected by {@link JwtAuthGuard})
 *
 * @see RegisterUseCase
 * @see LoginUseCase
 * @see RefreshUseCase
 * @see LogoutUseCase
 * @see GetCurrentUserUseCase
 * @see DomainExceptionFilter
 */
@ApiTags('Authentication')
@Controller('auth')
@UseFilters(DomainExceptionFilter)
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
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
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiOkResponse({
    status: 201,
    description: 'Registration successful',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({ description: 'Email already registered' })
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
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({
    description: 'Authentication successful',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
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
  @ApiOperation({ summary: 'Rotate the session using a valid refresh token' })
  @ApiOkResponse({ description: 'Rotation successful', type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or already-used refresh token',
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const result = await this.refreshUseCase.execute(
      new RefreshParams({ refreshToken: dto.refreshToken }),
    );

    return this.toResponse(result);
  }

  /**
   * POST /auth/logout
   *
   * Terminates the current session server-side by clearing the stored
   * refresh token hash for the authenticated user. The presented access
   * token is not itself revoked (see {@link IAuthRepository.logout}), but
   * any subsequent refresh attempt using the now-orphaned refresh token
   * fails with 401.
   *
   * Requires a valid, non-expired access token via {@link JwtAuthGuard}.
   * The user id is taken exclusively from the validated token (via
   * {@link CurrentUser}) — never from client-supplied input — so a user
   * can only ever terminate their own session.
   *
   * HTTP status codes:
   * - 200 OK           — session terminated (or was already inactive).
   * - 401 Unauthorized — missing, invalid, or expired access token.
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Terminate the current session' })
  @ApiOkResponse({ description: 'Session terminated' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
  })
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.logoutUseCase.execute(new LogoutParams({ userId: user.userId }));
  }

  /**
   * GET /auth/me
   *
   * Returns the authenticated user's current profile, excluding sensitive
   * fields (passwordHash, refreshTokenHash). Performs a fresh database
   * lookup rather than trusting the access token's claims alone, so a
   * client discovers promptly if the account was deactivated after the
   * token was issued.
   *
   * Requires a valid, non-expired access token via {@link JwtAuthGuard}.
   * The user id is taken exclusively from the validated token (via
   * {@link CurrentUser}).
   *
   * HTTP status codes:
   * - 200 OK           — profile returned.
   * - 401 Unauthorized — missing, invalid, or expired access token, or the
   *   token's user no longer resolves to an active account.
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retrieve the authenticated user profile' })
  @ApiOkResponse({ description: 'Profile returned', type: UserProfileDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
  })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    const currentUser = await this.getCurrentUserUseCase.execute(
      new GetCurrentUserParams({ userId: user.userId }),
    );

    return UserProfileDto.fromUserEntity(currentUser);
  }

  /**
   * Shapes the shared {@link AuthResponseDto} from an {@link AuthResult}.
   * Used by register, login, and refresh to avoid duplicating the mapping
   * logic. logout() has no AuthResult to map — it returns void. me()
   * returns a bare {@link UserProfileDto} — it has no tokens to include.
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
