import { Test, TestingModule } from '@nestjs/testing';

import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';
import { CreateRoomUseCase } from '../../../../src/room/domain/usecases/create-room.usecase';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';
import { CreateRoomDto } from '../../../../src/room/presentation/dtos/create-room.dto';
import { RoomResponseDto } from '../../../../src/room/presentation/dtos/room-response.dto';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { AuthenticatedUser } from '../../../../src/auth/presentation/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for RoomController (B-R01-T2 — presentation layer).
 *
 * CreateRoomUseCase is mocked. Tests verify:
 *   - The DTO and the authenticated user are correctly mapped to CreateRoomParams.
 *   - The response is correctly shaped as a RoomResponseDto.
 *   - The owner id is taken exclusively from the validated AuthenticatedUser
 *     (via @CurrentUser), never from client-supplied input.
 *
 * JwtAuthGuard itself is NOT exercised here (unit test calling the
 * controller method directly) — guard rejection (401) is verified by
 * create-room.integration.spec.ts against a fully bootstrapped application.
 *
 * @competency C2.2.2 — Unit test harness, TDD.
 * @competency C2.3.1 — Test scenarios R-CRE-01, R-CRE-05 (delegation, auth boundary).
 */
describe('RoomController', () => {
  let roomController: RoomController;

  const createExecute: jest.MockedFunction<CreateRoomUseCase['execute']> =
    jest.fn();

  const AUTHENTICATED_USER: AuthenticatedUser = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.REGISTERED,
  };

  const VALID_DTO: CreateRoomDto = Object.assign(new CreateRoomDto(), {
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    isPublic: true,
  });

  const MOCK_ROOM = new RoomEntity({
    id: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    ownerId: AUTHENTICATED_USER.userId,
    isPublic: true,
    memberCount: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

  beforeEach(async () => {
    createExecute.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        { provide: CreateRoomUseCase, useValue: { execute: createExecute } },
      ],
    }).compile();

    roomController = module.get<RoomController>(RoomController);
  });

  describe('create()', () => {
    it('should return a RoomResponseDto on success', async () => {
      createExecute.mockResolvedValue(MOCK_ROOM);

      const response = await roomController.create(
        VALID_DTO,
        AUTHENTICATED_USER,
      );

      expect(response).toBeInstanceOf(RoomResponseDto);
    });

    it('should call CreateRoomUseCase.execute with params built from the DTO and the authenticated user', async () => {
      createExecute.mockResolvedValue(MOCK_ROOM);

      await roomController.create(VALID_DTO, AUTHENTICATED_USER);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateRoomParams>>({
          ownerId: AUTHENTICATED_USER.userId,
          name: VALID_DTO.name,
          description: VALID_DTO.description,
          isPublic: true,
        }),
      );
    });

    it('should default isPublic to true when omitted from the DTO', async () => {
      createExecute.mockResolvedValue(MOCK_ROOM);
      const dtoWithoutVisibility: CreateRoomDto = Object.assign(
        new CreateRoomDto(),
        { name: 'Friday Movie Night' },
      );

      await roomController.create(dtoWithoutVisibility, AUTHENTICATED_USER);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateRoomParams>>({
          isPublic: true,
        }),
      );
    });

    it('should never take the owner id from the request body', async () => {
      createExecute.mockResolvedValue(MOCK_ROOM);
      const dtoWithSpoofedOwner = Object.assign(new CreateRoomDto(), {
        name: 'Friday Movie Night',
        // CreateRoomDto has no ownerId field at all, so this is stripped
        // by the global ValidationPipe's `whitelist: true` option well
        // before it would reach the controller — verified here defensively.
        ownerId: 'attacker-supplied-uuid',
      } as CreateRoomDto & { ownerId: string });

      await roomController.create(dtoWithSpoofedOwner, AUTHENTICATED_USER);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateRoomParams>>({
          ownerId: AUTHENTICATED_USER.userId,
        }),
      );
    });

    it('should map all RoomEntity fields into the response', async () => {
      createExecute.mockResolvedValue(MOCK_ROOM);

      const response = await roomController.create(
        VALID_DTO,
        AUTHENTICATED_USER,
      );

      expect(response.id).toBe(MOCK_ROOM.id);
      expect(response.name).toBe(MOCK_ROOM.name);
      expect(response.description).toBe(MOCK_ROOM.description);
      expect(response.ownerId).toBe(MOCK_ROOM.ownerId);
      expect(response.isPublic).toBe(true);
      expect(response.memberCount).toBe(1);
      expect(response.createdAt).toEqual(MOCK_ROOM.createdAt);
    });

    it('should not swallow unexpected errors', async () => {
      createExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        roomController.create(VALID_DTO, AUTHENTICATED_USER),
      ).rejects.toThrow('Database unavailable');
    });
  });
});
