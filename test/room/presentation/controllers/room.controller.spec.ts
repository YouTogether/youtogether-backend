import { Test, TestingModule } from '@nestjs/testing';

import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';
import { CreateRoomUseCase } from '../../../../src/room/domain/usecases/create-room.usecase';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';
import { GetPublicRoomsUseCase } from '../../../../src/room/domain/usecases/get-public-rooms.usecase';
import { GetRoomByIdUseCase } from '../../../../src/room/domain/usecases/get-room-by-id.usecase';
import { GetRoomByIdParams } from '../../../../src/room/domain/usecases/get-room-by-id.params';
import { UpdateRoomUseCase } from '../../../../src/room/domain/usecases/update-room.usecase';
import { UpdateRoomParams } from '../../../../src/room/domain/usecases/update-room.params';
import { UpdateRoomDto } from '../../../../src/room/presentation/dtos/update-room.dto';
import { DeleteRoomUseCase } from '../../../../src/room/domain/usecases/delete-room.usecase';
import { DeleteRoomParams } from '../../../../src/room/domain/usecases/delete-room.params';
import { JoinRoomUseCase } from '../../../../src/room/domain/usecases/join-room.usecase';
import { JoinRoomParams } from '../../../../src/room/domain/usecases/join-room.params';
import { LeaveRoomUseCase } from '../../../../src/room/domain/usecases/leave-room.usecase';
import { LeaveRoomParams } from '../../../../src/room/domain/usecases/leave-room.params';
import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import {
  RoomNotFoundFailure,
  RoomAlreadyJoinedFailure,
  RoomMembershipNotFoundFailure,
  RoomOwnerCannotLeaveFailure,
} from '../../../../src/room/domain/failures/room.failure';
import { CreateRoomDto } from '../../../../src/room/presentation/dtos/create-room.dto';
import { RoomResponseDto } from '../../../../src/room/presentation/dtos/room-response.dto';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { AuthenticatedUser } from '../../../../src/auth/presentation/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for RoomController (create(), findAll(), findOne(), update()
 * — presentation layer).
 *
 * All four use cases are mocked. Tests verify:
 *   - The DTO and the authenticated user are correctly mapped to the
 *     corresponding domain params.
 *   - The response is correctly shaped as RoomResponseDto / RoomResponseDto[].
 *   - The owner id is taken exclusively from the validated AuthenticatedUser
 *     (via @CurrentUser), never from client-supplied input.
 *
 * Neither JwtAuthGuard nor OwnershipGuard is exercised here (this is a
 * unit test calling controller methods directly) — guard rejection
 * (401/403/404) is verified by the corresponding `*.integration.spec.ts`
 * suites against a fully bootstrapped application.
 *
 * `IRoomRepository` is nonetheless provided (as an unused stub) because
 * `update()` is decorated with `@UseGuards(JwtAuthGuard, OwnershipGuard)`:
 * Nest resolves every guard referenced by class in that decorator when
 * compiling the TestingModule, regardless of whether the guard's
 * `canActivate()` is ever invoked in a given test — and `OwnershipGuard`
 * has a constructor dependency on `IRoomRepository`. Without this stub,
 * `Test.createTestingModule(...).compile()` throws
 * `UnknownDependenciesException` for every test in this file, not just
 * the ones exercising `update()`.
 *
 * @competency Unit test harness, TDD.
 * @competency Test scenarios R-CRE-01, R-CRE-05, R-LST-01, R-LST-06,
 *   R-DET-01 through R-DET-03, R-UPD-01, R-UPD-02, R-UPD-06.
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
  const updateRoomExecute: jest.MockedFunction<UpdateRoomUseCase['execute']> =
    jest.fn();
  const deleteRoomExecute: jest.MockedFunction<DeleteRoomUseCase['execute']> =
    jest.fn();
  const joinRoomExecute: jest.MockedFunction<JoinRoomUseCase['execute']> =
    jest.fn();
  const leaveRoomExecute: jest.MockedFunction<LeaveRoomUseCase['execute']> =
    jest.fn();

  const roomRepositoryStub: IRoomRepository = {
    create: jest.fn(),
    findOwnerId: jest.fn(),
    getPublicRooms: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };

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
    updateRoomExecute.mockReset();
    deleteRoomExecute.mockReset();
    joinRoomExecute.mockReset();
    leaveRoomExecute.mockReset();

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
        {
          provide: UpdateRoomUseCase,
          useValue: { execute: updateRoomExecute },
        },
        {
          provide: DeleteRoomUseCase,
          useValue: { execute: deleteRoomExecute },
        },
        {
          provide: JoinRoomUseCase,
          useValue: { execute: joinRoomExecute },
        },
        {
          provide: LeaveRoomUseCase,
          useValue: { execute: leaveRoomExecute },
        },
        { provide: IRoomRepository, useValue: roomRepositoryStub },
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

  // --- GET /rooms ---

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

  // --- GET /rooms/:id ---

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

  // --- PATCH /rooms/:id ---

  describe('update()', () => {
    const VALID_UPDATE_DTO: UpdateRoomDto = Object.assign(new UpdateRoomDto(), {
      name: 'Renamed Movie Night',
      description: 'Updated description',
    });

    const UPDATED_ROOM = new RoomEntity({
      ...MOCK_ROOM,
      name: 'Renamed Movie Night',
      description: 'Updated description',
    });

    it('should return a RoomResponseDto on success', async () => {
      updateRoomExecute.mockResolvedValue(UPDATED_ROOM);

      const response = await roomController.update(
        MOCK_ROOM.id,
        VALID_UPDATE_DTO,
      );

      expect(response).toBeInstanceOf(RoomResponseDto);
      expect(response.name).toBe('Renamed Movie Night');
    });

    it('should call UpdateRoomUseCase.execute with params built from the route param and DTO', async () => {
      updateRoomExecute.mockResolvedValue(UPDATED_ROOM);

      await roomController.update(MOCK_ROOM.id, VALID_UPDATE_DTO);

      expect(updateRoomExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<UpdateRoomParams>>({
          roomId: MOCK_ROOM.id,
          name: VALID_UPDATE_DTO.name,
          description: VALID_UPDATE_DTO.description,
        }),
      );
    });

    it('should support a partial update (description only)', async () => {
      updateRoomExecute.mockResolvedValue(UPDATED_ROOM);
      const partialDto: UpdateRoomDto = Object.assign(new UpdateRoomDto(), {
        description: 'Only description changes',
      });

      await roomController.update(MOCK_ROOM.id, partialDto);

      expect(updateRoomExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<UpdateRoomParams>>({
          name: undefined,
          description: 'Only description changes',
        }),
      );
    });

    it('should propagate RoomNotFoundFailure (RoomExceptionFilter maps it to 404) (R-UPD-06)', async () => {
      updateRoomExecute.mockRejectedValue(
        new RoomNotFoundFailure('unknown-id'),
      );

      await expect(
        roomController.update('unknown-id', VALID_UPDATE_DTO),
      ).rejects.toThrow(RoomNotFoundFailure);
    });

    it('should not swallow unexpected errors', async () => {
      updateRoomExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        roomController.update(MOCK_ROOM.id, VALID_UPDATE_DTO),
      ).rejects.toThrow('Database unavailable');
    });
  });

  // --- DELETE /rooms/:id ---

  describe('remove()', () => {
    it('should resolve with no value on success (R-DEL-01)', async () => {
      deleteRoomExecute.mockResolvedValue(undefined);

      await expect(
        roomController.remove(MOCK_ROOM.id),
      ).resolves.toBeUndefined();
    });

    it('should call DeleteRoomUseCase.execute with params built from the route parameter', async () => {
      deleteRoomExecute.mockResolvedValue(undefined);

      await roomController.remove(MOCK_ROOM.id);

      expect(deleteRoomExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<DeleteRoomParams>>({
          roomId: MOCK_ROOM.id,
        }),
      );
      expect(deleteRoomExecute).toHaveBeenCalledTimes(1);
    });

    it('should propagate RoomNotFoundFailure (RoomExceptionFilter maps it to 404) (R-DEL-05)', async () => {
      deleteRoomExecute.mockRejectedValue(
        new RoomNotFoundFailure('unknown-id'),
      );

      await expect(roomController.remove('unknown-id')).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should not swallow unexpected errors', async () => {
      deleteRoomExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(roomController.remove(MOCK_ROOM.id)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });

  // --- POST /rooms/:id/join ---

  describe('join()', () => {
    const JOINED_ROOM = new RoomEntity({ ...MOCK_ROOM, memberCount: 2 });

    it('should return a RoomResponseDto on success', async () => {
      joinRoomExecute.mockResolvedValue(JOINED_ROOM);

      const response = await roomController.join(
        MOCK_ROOM.id,
        AUTHENTICATED_USER,
      );

      expect(response).toBeInstanceOf(RoomResponseDto);
      expect(response.memberCount).toBe(2);
    });

    it('should call JoinRoomUseCase.execute with params built from the route parameter and the authenticated user', async () => {
      joinRoomExecute.mockResolvedValue(JOINED_ROOM);

      await roomController.join(MOCK_ROOM.id, AUTHENTICATED_USER);

      expect(joinRoomExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<JoinRoomParams>>({
          roomId: MOCK_ROOM.id,
          userId: AUTHENTICATED_USER.userId,
        }),
      );
    });

    it('should propagate RoomNotFoundFailure (RoomExceptionFilter maps it to 404) (R-JOI-04)', async () => {
      joinRoomExecute.mockRejectedValue(new RoomNotFoundFailure('unknown-id'));

      await expect(
        roomController.join('unknown-id', AUTHENTICATED_USER),
      ).rejects.toThrow(RoomNotFoundFailure);
    });

    it('should propagate RoomAlreadyJoinedFailure (RoomExceptionFilter maps it to 409) (R-JOI-03)', async () => {
      joinRoomExecute.mockRejectedValue(
        new RoomAlreadyJoinedFailure(MOCK_ROOM.id, AUTHENTICATED_USER.userId),
      );

      await expect(
        roomController.join(MOCK_ROOM.id, AUTHENTICATED_USER),
      ).rejects.toThrow(RoomAlreadyJoinedFailure);
    });

    it('should not swallow unexpected errors', async () => {
      joinRoomExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        roomController.join(MOCK_ROOM.id, AUTHENTICATED_USER),
      ).rejects.toThrow('Database unavailable');
    });
  });

  // --- POST /rooms/:id/leave ---

  describe('leave()', () => {
    it('should resolve with no value on success (R-LEA-01)', async () => {
      leaveRoomExecute.mockResolvedValue(undefined);

      await expect(
        roomController.leave(MOCK_ROOM.id, AUTHENTICATED_USER),
      ).resolves.toBeUndefined();
    });

    it('should call LeaveRoomUseCase.execute with params built from the route parameter and the authenticated user', async () => {
      leaveRoomExecute.mockResolvedValue(undefined);

      await roomController.leave(MOCK_ROOM.id, AUTHENTICATED_USER);

      expect(leaveRoomExecute).toHaveBeenCalledWith(
        expect.objectContaining<Partial<LeaveRoomParams>>({
          roomId: MOCK_ROOM.id,
          userId: AUTHENTICATED_USER.userId,
        }),
      );
    });

    it('should propagate RoomMembershipNotFoundFailure (RoomExceptionFilter maps it to 404) (R-LEA-03)', async () => {
      leaveRoomExecute.mockRejectedValue(
        new RoomMembershipNotFoundFailure(
          MOCK_ROOM.id,
          AUTHENTICATED_USER.userId,
        ),
      );

      await expect(
        roomController.leave(MOCK_ROOM.id, AUTHENTICATED_USER),
      ).rejects.toThrow(RoomMembershipNotFoundFailure);
    });

    it('should propagate RoomOwnerCannotLeaveFailure (RoomExceptionFilter maps it to 403) (R-LEA-04)', async () => {
      leaveRoomExecute.mockRejectedValue(
        new RoomOwnerCannotLeaveFailure(MOCK_ROOM.id),
      );

      await expect(
        roomController.leave(MOCK_ROOM.id, AUTHENTICATED_USER),
      ).rejects.toThrow(RoomOwnerCannotLeaveFailure);
    });

    it('should not swallow unexpected errors', async () => {
      leaveRoomExecute.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        roomController.leave(MOCK_ROOM.id, AUTHENTICATED_USER),
      ).rejects.toThrow('Database unavailable');
    });
  });
});
