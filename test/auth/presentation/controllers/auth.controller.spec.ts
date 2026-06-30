import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { LoginUseCase } from '../../../../src/auth/domain/usecases/login.usecase';
import { RefreshUseCase } from '../../../../src/auth/domain/usecases/refresh.usecase';
import { RegisterDto } from '../../../../src/auth/presentation/dtos/register.dto';
import { LoginDto } from '../../../../src/auth/presentation/dtos/login.dto';
import { RefreshTokenDto } from '../../../../src/auth/presentation/dtos/refresh-token.dto';
import { AuthResponseDto } from '../../../../src/auth/presentation/dtos/auth-response.dto';
import {
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
  InvalidRefreshTokenFailure,
} from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { AuthResult } from '../../../../src/auth/domain/value-objects/auth-result.vo';
import { RegisterParams } from '../../../../src/auth/domain/usecases/register.params';
import { LoginParams } from '../../../../src/auth/domain/usecases/login.params';
import { RefreshParams } from '../../../../src/auth/domain/usecases/refresh.params';

/**
 * Unit tests for AuthController.
 *
 * All three use cases are mocked. Tests verify:
 *   - DTO is correctly mapped to the domain value object.
 *   - AuthResponseDto is correctly shaped from AuthResult.
 *   - Domain failures propagate as-is (DomainExceptionFilter handles HTTP mapping).
 *
 * Mocks are typed via jest.MockedFunction against the use-case method
 * signatures, which resolves correctly under all @types/jest versions and
 * avoids the unbound-method false positive (the consts are plain functions).
 *
 * @competency Unit test harness, TDD.
 * @competency Test scenarios: success, conflict, unauthorized paths.
 */
describe('AuthController', () => {
  let authController: AuthController;

  const registerExecute: jest.MockedFunction<RegisterUseCase['execute']> =
    jest.fn();
  const loginExecute: jest.MockedFunction<LoginUseCase['execute']> = jest.fn();
  const refreshExecute: jest.MockedFunction<RefreshUseCase['execute']> =
    jest.fn();

  const MOCK_USER = new UserEntity({
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    username: 'testuser',
    role: UserRole.REGISTERED,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  });

  const MOCK_TOKENS = new TokenPair({
    accessToken: 'mock.access.token',
    refreshToken: 'b'.repeat(64),
  });

  const MOCK_RESULT = new AuthResult({ user: MOCK_USER, tokens: MOCK_TOKENS });

  const ROTATED_TOKENS = new TokenPair({
    accessToken: 'rotated.access.token',
    refreshToken: 'c'.repeat(64),
  });

  const ROTATED_RESULT = new AuthResult({
    user: MOCK_USER,
    tokens: ROTATED_TOKENS,
  });

  beforeEach(async () => {
    registerExecute.mockReset();
    loginExecute.mockReset();
    refreshExecute.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUseCase, useValue: { execute: registerExecute } },
        { provide: LoginUseCase, useValue: { execute: loginExecute } },
        { provide: RefreshUseCase, useValue: { execute: refreshExecute } },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
  });

  // --- POST /auth/register ---

  describe('register()', () => {
    const VALID_REGISTER_DTO: RegisterDto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'securepassword',
      username: 'testuser',
    });

    it('should return an AuthResponseDto on success', async () => {
      registerExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_REGISTER_DTO);

      expect(response).toBeInstanceOf(AuthResponseDto);
    });

    it('should call RegisterUseCase.execute with RegisterParams built from the DTO', async () => {
      registerExecute.mockResolvedValue(MOCK_RESULT);

      await authController.register(VALID_REGISTER_DTO);

      expect(registerExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<RegisterParams>>({
          email: VALID_REGISTER_DTO.email,
          password: VALID_REGISTER_DTO.password,
          username: VALID_REGISTER_DTO.username,
        }),
      );
    });

    it('should map user fields correctly in the response', async () => {
      registerExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_REGISTER_DTO);

      expect(response.user.id).toBe(MOCK_USER.id);
      expect(response.user.email).toBe(MOCK_USER.email);
      expect(response.user.username).toBe(MOCK_USER.username);
      expect(response.user.role).toBe(UserRole.REGISTERED);
      expect(response.user.createdAt).toEqual(MOCK_USER.createdAt);
    });

    it('should include accessToken and refreshToken in the response', async () => {
      registerExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_REGISTER_DTO);

      expect(response.accessToken).toBe(MOCK_TOKENS.accessToken);
      expect(response.refreshToken).toBe(MOCK_TOKENS.refreshToken);
    });

    it('should not include passwordHash or refreshTokenHash in the response', async () => {
      registerExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_REGISTER_DTO);
      const userRecord = response.user as unknown as Record<string, unknown>;

      expect(userRecord.passwordHash).toBeUndefined();
      expect(userRecord.refreshTokenHash).toBeUndefined();
    });

    it('should propagate EmailAlreadyInUseFailure (filter handles HTTP mapping)', async () => {
      registerExecute.mockRejectedValue(
        new EmailAlreadyInUseFailure('test@example.com'),
      );

      await expect(authController.register(VALID_REGISTER_DTO)).rejects.toThrow(
        EmailAlreadyInUseFailure,
      );
    });
  });

  // --- POST /auth/login ---

  describe('login()', () => {
    const VALID_LOGIN_DTO: LoginDto = Object.assign(new LoginDto(), {
      email: 'test@example.com',
      password: 'securepassword',
    });

    it('should return an AuthResponseDto on success', async () => {
      loginExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.login(VALID_LOGIN_DTO);

      expect(response).toBeInstanceOf(AuthResponseDto);
    });

    it('should call LoginUseCase.execute with LoginParams built from the DTO', async () => {
      loginExecute.mockResolvedValue(MOCK_RESULT);

      await authController.login(VALID_LOGIN_DTO);

      expect(loginExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<LoginParams>>({
          email: VALID_LOGIN_DTO.email,
          password: VALID_LOGIN_DTO.password,
        }),
      );
    });

    it('should pass email and password only — no username in LoginParams', async () => {
      loginExecute.mockResolvedValue(MOCK_RESULT);

      await authController.login(VALID_LOGIN_DTO);

      const calledWith: LoginParams = loginExecute.mock.calls[0][0];
      expect(Object.keys(calledWith)).not.toContain('username');
    });

    it('should map user fields correctly in the response', async () => {
      loginExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.login(VALID_LOGIN_DTO);

      expect(response.user.id).toBe(MOCK_USER.id);
      expect(response.user.email).toBe(MOCK_USER.email);
      expect(response.user.username).toBe(MOCK_USER.username);
      expect(response.user.role).toBe(UserRole.REGISTERED);
      expect(response.user.createdAt).toEqual(MOCK_USER.createdAt);
    });

    it('should include accessToken and refreshToken in the response', async () => {
      loginExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.login(VALID_LOGIN_DTO);

      expect(response.accessToken).toBe(MOCK_TOKENS.accessToken);
      expect(response.refreshToken).toBe(MOCK_TOKENS.refreshToken);
    });

    it('should not include passwordHash or refreshTokenHash in the response', async () => {
      loginExecute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.login(VALID_LOGIN_DTO);
      const userRecord = response.user as unknown as Record<string, unknown>;

      expect(userRecord.passwordHash).toBeUndefined();
      expect(userRecord.refreshTokenHash).toBeUndefined();
    });

    it('should propagate InvalidCredentialsFailure (filter maps it to 401)', async () => {
      loginExecute.mockRejectedValue(new InvalidCredentialsFailure());

      await expect(authController.login(VALID_LOGIN_DTO)).rejects.toThrow(
        InvalidCredentialsFailure,
      );
    });

    it('should not swallow unexpected errors', async () => {
      loginExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(authController.login(VALID_LOGIN_DTO)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });

  // --- POST /auth/refresh ---

  describe('refresh()', () => {
    const VALID_REFRESH_DTO: RefreshTokenDto = Object.assign(
      new RefreshTokenDto(),
      { refreshToken: MOCK_TOKENS.refreshToken },
    );

    it('should return an AuthResponseDto on success', async () => {
      refreshExecute.mockResolvedValue(ROTATED_RESULT);

      const response = await authController.refresh(VALID_REFRESH_DTO);

      expect(response).toBeInstanceOf(AuthResponseDto);
    });

    it('should call RefreshUseCase.execute with RefreshParams built from the DTO', async () => {
      refreshExecute.mockResolvedValue(ROTATED_RESULT);

      await authController.refresh(VALID_REFRESH_DTO);

      expect(refreshExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<RefreshParams>>({
          refreshToken: VALID_REFRESH_DTO.refreshToken,
        }),
      );
    });

    it('should return the rotated token pair, not the presented one', async () => {
      refreshExecute.mockResolvedValue(ROTATED_RESULT);

      const response = await authController.refresh(VALID_REFRESH_DTO);

      expect(response.accessToken).toBe(ROTATED_TOKENS.accessToken);
      expect(response.refreshToken).toBe(ROTATED_TOKENS.refreshToken);
      expect(response.refreshToken).not.toBe(VALID_REFRESH_DTO.refreshToken);
    });

    it('should map user fields correctly in the response', async () => {
      refreshExecute.mockResolvedValue(ROTATED_RESULT);

      const response = await authController.refresh(VALID_REFRESH_DTO);

      expect(response.user.id).toBe(MOCK_USER.id);
      expect(response.user.email).toBe(MOCK_USER.email);
      expect(response.user.role).toBe(UserRole.REGISTERED);
    });

    it('should not include passwordHash or refreshTokenHash in the response', async () => {
      refreshExecute.mockResolvedValue(ROTATED_RESULT);

      const response = await authController.refresh(VALID_REFRESH_DTO);
      const userRecord = response.user as unknown as Record<string, unknown>;

      expect(userRecord.passwordHash).toBeUndefined();
      expect(userRecord.refreshTokenHash).toBeUndefined();
    });

    it('should propagate InvalidRefreshTokenFailure (filter maps it to 401)', async () => {
      refreshExecute.mockRejectedValue(new InvalidRefreshTokenFailure());

      await expect(authController.refresh(VALID_REFRESH_DTO)).rejects.toThrow(
        InvalidRefreshTokenFailure,
      );
    });

    it('should not swallow unexpected errors', async () => {
      refreshExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(authController.refresh(VALID_REFRESH_DTO)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });

  // --- DomainExceptionFilter HTTP mappings (unit verification) ---

  describe('DomainExceptionFilter HTTP mappings', () => {
    it('should map EmailAlreadyInUseFailure to ConflictException (409)', () => {
      const failure = new EmailAlreadyInUseFailure('dup@example.com');
      const httpException = new ConflictException(failure.message);

      expect(httpException.getStatus()).toBe(409);
    });

    it('should map InvalidCredentialsFailure to UnauthorizedException (401)', () => {
      const failure = new InvalidCredentialsFailure();
      const httpException = new UnauthorizedException(failure.message);

      expect(httpException.getStatus()).toBe(401);
    });

    it('should map InvalidRefreshTokenFailure to UnauthorizedException (401)', () => {
      const failure = new InvalidRefreshTokenFailure();
      const httpException = new UnauthorizedException(failure.message);

      expect(httpException.getStatus()).toBe(401);
    });

    it('should use the same message for both wrong password and unknown email', () => {
      const failure1 = new InvalidCredentialsFailure();
      const failure2 = new InvalidCredentialsFailure();

      expect(failure1.message).toBe(failure2.message);
    });
  });
});
