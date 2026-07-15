import { Test, TestingModule } from '@nestjs/testing';

import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';
import { CreateRoomUseCase } from '../../../../src/room/domain/usecases/create-room.usecase';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';
import { GetPublicRoomsUseCase } from '../../../../src/room/domain/usecases/get-public-rooms.usecase';
import { GetRoomByIdUseCase } from '../../../../src/room/domain/usecases/get-room-by-id.usecase';
import { GetRoomByIdParams } from '../../../../src/room/domain/usecases/get-room-by-id.params';
import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';
import { CreateRoomDto } from '../../../../src/room/presentation/dtos/create-room.dto';
import { RoomResponseDto } from '../../../../src/room/presentation/dtos/room-response.dto';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { AuthenticatedUser } from '../../../../src/auth/presentation/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for RoomController.
 *
 * CreateRoomUseCase and GetPublicRoomsUseCase are mocked. Tests verify:
 *   - The DTO and the authenticated user are correctly mapped to CreateRoomParams.
 *   - The response is correctly shaped as RoomResponseDto / RoomResponseDto[].
 *   - The owner id is taken exclusively from the validated AuthenticatedUser
 *     (via @CurrentUser), never from client-supplied input.
 *
 * JwtAuthGuard itself is NOT exercised here (unit test calling the
 * controller method directly) — guard rejection (401) is verified by
 * create-room.integration.spec.ts against a fully bootstrapped application.
 * findAll() requires no guard at all (public listing).
 *
 * @competency Unit test harness, TDD.
 * @competency Test scenarios R-CRE-01, R-CRE-05, R-LST-01, R-LST-06.
 */
describe('RoomController', () => {
  let roomController: RoomController;

  const createExecute: jest.MockedFunction<CreateRoomUseCase['execute']> =
    jest.fn();
  const getPublicRoomsExecute: jest.MockedFunction<
    GetPublicRoomsUseCase['execute']
  > = jest.fn();
  const getRoomByIdExecute: jest.MockedFunction<GetRoomByIdUseCase['execute']> =
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
    getPublicRoomsExecute.mockReset();
    getRoomByIdExecute.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        { provide: CreateRoomUseCase, useValue: { execute: createExecute } },
        {
          provide: GetPublicRoomsUseCase,
          useValue: { execute: getPublicRoomsExecute },
        },
        {
          provide: GetRoomByIdUseCase,
          useValue: { execute: getRoomByIdExecute },
        },
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

  // --- GET /rooms (B-R02-T1) ---

  describe('findAll()', () => {
    const MOCK_ROOMS = [MOCK_ROOM];

    it('should return a list of RoomResponseDto', async () => {
      getPublicRoomsExecute.mockResolvedValue(MOCK_ROOMS);

      const response = await roomController.findAll();

      expect(response).toHaveLength(1);
      expect(response[0]).toBeInstanceOf(RoomResponseDto);
    });

    it('should call GetPublicRoomsUseCase.execute with no arguments', async () => {
      getPublicRoomsExecute.mockResolvedValue(MOCK_ROOMS);

      await roomController.findAll();

      expect(getPublicRoomsExecute).toHaveBeenCalledWith();
    });

    it('should return an empty array when no public rooms exist (R-LST-06)', async () => {
      getPublicRoomsExecute.mockResolvedValue([]);

      const response = await roomController.findAll();

      expect(response).toEqual([]);
    });

    it('should map all RoomEntity fields into each response item', async () => {
      getPublicRoomsExecute.mockResolvedValue(MOCK_ROOMS);

      const [response] = await roomController.findAll();

      expect(response.id).toBe(MOCK_ROOM.id);
      expect(response.memberCount).toBe(MOCK_ROOM.memberCount);
    });

    it('should not swallow unexpected errors', async () => {
      getPublicRoomsExecute.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await expect(roomController.findAll()).rejects.toThrow(
        'Database unavailable',
      );
    });
  });

  // --- GET /rooms/:id (B-R03-T1) ---

  describe('findOne()', () => {
    it('should return a RoomResponseDto on success', async () => {
      getRoomByIdExecute.mockResolvedValue(MOCK_ROOM);

      const response = await roomController.findOne(MOCK_ROOM.id);

      expect(response).toBeInstanceOf(RoomResponseDto);
      expect(response.id).toBe(MOCK_ROOM.id);
      expect(response.memberCount).toBe(MOCK_ROOM.memberCount);
    });

    it('should call GetRoomByIdUseCase.execute with params built from the route parameter', async () => {
      getRoomByIdExecute.mockResolvedValue(MOCK_ROOM);

      await roomController.findOne(MOCK_ROOM.id);

      expect(getRoomByIdExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<GetRoomByIdParams>>({
          roomId: MOCK_ROOM.id,
        }),
      );
    });

    it('should propagate RoomNotFoundFailure (RoomExceptionFilter maps it to 404) (R-DET-02/03)', async () => {
      getRoomByIdExecute.mockRejectedValue(
        new RoomNotFoundFailure('unknown-id'),
      );

      await expect(roomController.findOne('unknown-id')).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should not swallow unexpected errors', async () => {
      getRoomByIdExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(roomController.findOne(MOCK_ROOM.id)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});
