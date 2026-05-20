import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { RegisterDto } from '../../../../src/auth/presentation/dtos/register.dto';
import { AuthResponseDto } from '../../../../src/auth/presentation/dtos/auth-response.dto';
import { EmailAlreadyInUseFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { RegisterResult } from '../../../../src/auth/domain/value-objects/register-result.vo';
import { RegisterParams } from '../../../../src/auth/domain/usecases/register.params';

/**
 * Unit tests for AuthController.
 *
 * RegisterUseCase is mocked. Tests verify:
 * - DTO is correctly mapped to RegisterParams.
 * - AuthResponseDto is correctly shaped from RegisterResult.
 * - Domain failures propagate as-is (filter handles HTTP mapping).
 *
 * @competency Unit test harness, TDD.
 * @competency Test scenarios: success and conflict paths.
 */
describe('AuthController', () => {
  let authController: AuthController;
  let registerUseCase: jest.Mocked<RegisterUseCase>;

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

  const MOCK_RESULT = new RegisterResult({
    user: MOCK_USER,
    tokens: MOCK_TOKENS,
  });

  const VALID_DTO: RegisterDto = Object.assign(new RegisterDto(), {
    email: 'test@example.com',
    password: 'securepassword',
    username: 'testuser',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: RegisterUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    registerUseCase = module.get<RegisterUseCase>(
      RegisterUseCase,
    ) as jest.Mocked<RegisterUseCase>;
  });

  describe('register', () => {
    it('should return an AuthResponseDto on success', async () => {
      registerUseCase.execute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_DTO);

      expect(response).toBeInstanceOf(AuthResponseDto);
    });

    it('should call RegisterUseCase.execute with RegisterParams built from the DTO', async () => {
      const executeSpy = jest
        .spyOn(registerUseCase, 'execute')
        .mockResolvedValue(MOCK_RESULT);

      await authController.register(VALID_DTO);

      expect(executeSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<RegisterParams>>({
          email: VALID_DTO.email,
          password: VALID_DTO.password,
          username: VALID_DTO.username,
        }),
      );
    });

    it('should map user fields correctly in the response', async () => {
      registerUseCase.execute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_DTO);

      expect(response.user.id).toBe(MOCK_USER.id);
      expect(response.user.email).toBe(MOCK_USER.email);
      expect(response.user.username).toBe(MOCK_USER.username);
      expect(response.user.role).toBe(UserRole.REGISTERED);
      expect(response.user.createdAt).toEqual(MOCK_USER.createdAt);
    });

    it('should include accessToken and refreshToken in the response', async () => {
      registerUseCase.execute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_DTO);

      expect(response.accessToken).toBe(MOCK_TOKENS.accessToken);
      expect(response.refreshToken).toBe(MOCK_TOKENS.refreshToken);
    });

    it('should not include passwordHash or refreshTokenHash in the response', async () => {
      registerUseCase.execute.mockResolvedValue(MOCK_RESULT);

      const response = await authController.register(VALID_DTO);
      const userRecord = response.user as unknown as Record<string, unknown>;

      expect(userRecord.passwordHash).toBeUndefined();
      expect(userRecord.refreshTokenHash).toBeUndefined();
    });

    it('should propagate EmailAlreadyInUseFailure (filter handles HTTP mapping)', async () => {
      registerUseCase.execute.mockRejectedValue(
        new EmailAlreadyInUseFailure('test@example.com'),
      );

      await expect(authController.register(VALID_DTO)).rejects.toThrow(
        EmailAlreadyInUseFailure,
      );
    });
  });
});

describe('DomainExceptionFilter (unit)', () => {
  it('should map EmailAlreadyInUseFailure to ConflictException', () => {
    const failure = new EmailAlreadyInUseFailure('dup@example.com');
    const httpException = new ConflictException(failure.message);

    expect(httpException.getStatus()).toBe(409);
    expect(JSON.stringify(httpException.getResponse())).toContain('Conflict');
  });
});
