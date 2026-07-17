import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';
import { GetRoomByIdParams } from '../../../../src/room/domain/usecases/get-room-by-id.params';
import { GetRoomByIdUseCase } from '../../../../src/room/domain/usecases/get-room-by-id.usecase';

/**
 * Unit tests for GetRoomByIdUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.getById}, mirroring
 * `get-current-user.usecase.spec.ts`.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-DET-01, R-DET-02, R-DET-03.
 */
describe('GetRoomByIdUseCase', () => {
  let getRoomByIdUseCase: GetRoomByIdUseCase;
  const createMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const getPublicRoomsMock = jest.fn();
  const getByIdMock = jest.fn<Promise<RoomEntity>, [string]>();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();
  const joinMock = jest.fn();
  const leaveMock = jest.fn();

  const VALID_PARAMS = new GetRoomByIdParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
  });

  const MOCK_ROOM = new RoomEntity({
    id: VALID_PARAMS.roomId,
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
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
    getRoomByIdUseCase = new GetRoomByIdUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.getById with the room id', async () => {
      getByIdMock.mockResolvedValue(MOCK_ROOM);

      await getRoomByIdUseCase.execute(VALID_PARAMS);

      expect(getByIdMock).toHaveBeenCalledWith(VALID_PARAMS.roomId);
      expect(getByIdMock).toHaveBeenCalledTimes(1);
    });

    it('should return the RoomEntity provided by the repository', async () => {
      getByIdMock.mockResolvedValue(MOCK_ROOM);

      const result = await getRoomByIdUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_ROOM);
    });

    it('should propagate RoomNotFoundFailure from the repository (R-DET-02/03)', async () => {
      getByIdMock.mockRejectedValue(
        new RoomNotFoundFailure(VALID_PARAMS.roomId),
      );

      await expect(getRoomByIdUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      getByIdMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(getRoomByIdUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

describe('GetRoomByIdParams', () => {
  it('should store roomId as a readonly field', () => {
    const params = new GetRoomByIdParams({ roomId: 'room-id-value' });

    expect(params.roomId).toBe('room-id-value');
  });
});
