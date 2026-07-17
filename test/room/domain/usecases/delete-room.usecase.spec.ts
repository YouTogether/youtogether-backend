import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';
import { DeleteRoomParams } from '../../../../src/room/domain/usecases/delete-room.params';
import { DeleteRoomUseCase } from '../../../../src/room/domain/usecases/delete-room.usecase';

/**
 * Unit tests for DeleteRoomUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.delete}, mirroring `update-room.usecase.spec.ts`.
 * Ownership authorization is NOT this use case's concern — already
 * enforced upstream by `OwnershipGuard` (see RoomController.remove).
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-DEL-01, R-DEL-05.
 */
describe('DeleteRoomUseCase', () => {
  let deleteRoomUseCase: DeleteRoomUseCase;
  const createMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const getPublicRoomsMock = jest.fn();
  const getByIdMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn<Promise<void>, [string]>();
  const joinMock = jest.fn();

  const VALID_PARAMS = new DeleteRoomParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
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
    deleteRoomUseCase = new DeleteRoomUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.delete with the room id', async () => {
      deleteMock.mockResolvedValue(undefined);

      await deleteRoomUseCase.execute(VALID_PARAMS);

      expect(deleteMock).toHaveBeenCalledWith(VALID_PARAMS.roomId);
      expect(deleteMock).toHaveBeenCalledTimes(1);
    });

    it('should resolve with no value on success', async () => {
      deleteMock.mockResolvedValue(undefined);

      await expect(
        deleteRoomUseCase.execute(VALID_PARAMS),
      ).resolves.toBeUndefined();
    });

    it('should propagate RoomNotFoundFailure from the repository (R-DEL-05)', async () => {
      deleteMock.mockRejectedValue(
        new RoomNotFoundFailure(VALID_PARAMS.roomId),
      );

      await expect(deleteRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      deleteMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(deleteRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

describe('DeleteRoomParams', () => {
  it('should store roomId as a readonly field', () => {
    const params = new DeleteRoomParams({ roomId: 'room-id-value' });

    expect(params.roomId).toBe('room-id-value');
  });
});
