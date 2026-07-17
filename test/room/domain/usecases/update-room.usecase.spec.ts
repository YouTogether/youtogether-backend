import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';
import { UpdateRoomParams } from '../../../../src/room/domain/usecases/update-room.params';
import { UpdateRoomUseCase } from '../../../../src/room/domain/usecases/update-room.usecase';

/**
 * Unit tests for UpdateRoomUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.update}, mirroring `create-room.usecase.spec.ts`.
 * Ownership authorization is NOT this use case's concern — it is already
 * enforced upstream by `OwnershipGuard` before the controller ever calls
 * this use case (see RoomController.update).
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-UPD-01, R-UPD-02, R-UPD-06.
 */
describe('UpdateRoomUseCase', () => {
  let updateRoomUseCase: UpdateRoomUseCase;
  const createMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const getPublicRoomsMock = jest.fn();
  const getByIdMock = jest.fn();
  const updateMock = jest.fn<Promise<RoomEntity>, [UpdateRoomParams]>();
  const deleteMock = jest.fn();
  const joinMock = jest.fn();

  const VALID_PARAMS = new UpdateRoomParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    name: 'Renamed Movie Night',
    description: 'Updated description',
  });

  const MOCK_ROOM = new RoomEntity({
    id: VALID_PARAMS.roomId,
    name: 'Renamed Movie Night',
    description: 'Updated description',
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
    isPublic: true,
    memberCount: 2,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  });

  beforeEach(() => {
    createMock.mockReset();
    findOwnerIdMock.mockReset();
    getPublicRoomsMock.mockReset();
    getByIdMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    joinMock.mockReset();
    const roomRepository: IRoomRepository = {
      create: createMock,
      findOwnerId: findOwnerIdMock,
      getPublicRooms: getPublicRoomsMock,
      getById: getByIdMock,
      update: updateMock,
      delete: deleteMock,
      join: joinMock,
    };
    updateRoomUseCase = new UpdateRoomUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.update with the provided params', async () => {
      updateMock.mockResolvedValue(MOCK_ROOM);

      await updateRoomUseCase.execute(VALID_PARAMS);

      expect(updateMock).toHaveBeenCalledWith(VALID_PARAMS);
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('should return the updated RoomEntity provided by the repository', async () => {
      updateMock.mockResolvedValue(MOCK_ROOM);

      const result = await updateRoomUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_ROOM);
    });

    it('should propagate RoomNotFoundFailure from the repository (R-UPD-06)', async () => {
      updateMock.mockRejectedValue(
        new RoomNotFoundFailure(VALID_PARAMS.roomId),
      );

      await expect(updateRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      updateMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(updateRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

describe('UpdateRoomParams', () => {
  it('should store roomId, name, and description as readonly fields', () => {
    const params = new UpdateRoomParams({
      roomId: 'room-id-value',
      name: 'New Name',
      description: 'New description',
    });

    expect(params.roomId).toBe('room-id-value');
    expect(params.name).toBe('New Name');
    expect(params.description).toBe('New description');
  });

  it('should default name and description to undefined when omitted (R-UPD-02, partial update)', () => {
    const params = new UpdateRoomParams({ roomId: 'room-id-value' });

    expect(params.name).toBeUndefined();
    expect(params.description).toBeUndefined();
  });
});
