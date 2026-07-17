import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import {
  RoomNotFoundFailure,
  RoomAlreadyJoinedFailure,
} from '../../../../src/room/domain/failures/room.failure';
import { JoinRoomParams } from '../../../../src/room/domain/usecases/join-room.params';
import { JoinRoomUseCase } from '../../../../src/room/domain/usecases/join-room.usecase';

/**
 * Unit tests for JoinRoomUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.join}, mirroring `update-room.usecase.spec.ts`.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-JOI-01, R-JOI-03, R-JOI-04.
 */
describe('JoinRoomUseCase', () => {
  let joinRoomUseCase: JoinRoomUseCase;
  const createMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const getPublicRoomsMock = jest.fn();
  const getByIdMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();
  const joinMock = jest.fn<Promise<RoomEntity>, [string, string]>();
  const leaveMock = jest.fn();

  const VALID_PARAMS = new JoinRoomParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    userId: '550e8400-e29b-41d4-a716-446655440000',
  });

  const MOCK_ROOM = new RoomEntity({
    id: VALID_PARAMS.roomId,
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    ownerId: '660e8400-e29b-41d4-a716-446655440001',
    isPublic: true,
    memberCount: 2,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

  beforeEach(() => {
    createMock.mockReset();
    findOwnerIdMock.mockReset();
    getPublicRoomsMock.mockReset();
    getByIdMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    joinMock.mockReset();
    leaveMock.mockReset();
    const roomRepository: IRoomRepository = {
      create: createMock,
      findOwnerId: findOwnerIdMock,
      getPublicRooms: getPublicRoomsMock,
      getById: getByIdMock,
      update: updateMock,
      delete: deleteMock,
      join: joinMock,
      leave: leaveMock,
    };
    joinRoomUseCase = new JoinRoomUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.join with the room id and user id', async () => {
      joinMock.mockResolvedValue(MOCK_ROOM);

      await joinRoomUseCase.execute(VALID_PARAMS);

      expect(joinMock).toHaveBeenCalledWith(
        VALID_PARAMS.roomId,
        VALID_PARAMS.userId,
      );
      expect(joinMock).toHaveBeenCalledTimes(1);
    });

    it('should return the updated RoomEntity provided by the repository', async () => {
      joinMock.mockResolvedValue(MOCK_ROOM);

      const result = await joinRoomUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_ROOM);
    });

    it('should propagate RoomNotFoundFailure (R-JOI-04)', async () => {
      joinMock.mockRejectedValue(new RoomNotFoundFailure(VALID_PARAMS.roomId));

      await expect(joinRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should propagate RoomAlreadyJoinedFailure (R-JOI-03)', async () => {
      joinMock.mockRejectedValue(
        new RoomAlreadyJoinedFailure(VALID_PARAMS.roomId, VALID_PARAMS.userId),
      );

      await expect(joinRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomAlreadyJoinedFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      joinMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(joinRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

describe('JoinRoomParams', () => {
  it('should store roomId and userId as readonly fields', () => {
    const params = new JoinRoomParams({
      roomId: 'room-id-value',
      userId: 'user-id-value',
    });

    expect(params.roomId).toBe('room-id-value');
    expect(params.userId).toBe('user-id-value');
  });
});
