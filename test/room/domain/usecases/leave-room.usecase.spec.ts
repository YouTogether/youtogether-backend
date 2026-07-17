import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import {
  RoomMembershipNotFoundFailure,
  RoomOwnerCannotLeaveFailure,
} from '../../../../src/room/domain/failures/room.failure';
import { LeaveRoomParams } from '../../../../src/room/domain/usecases/leave-room.params';
import { LeaveRoomUseCase } from '../../../../src/room/domain/usecases/leave-room.usecase';

/**
 * Unit tests for LeaveRoomUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.leave}, mirroring `delete-room.usecase.spec.ts`.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-LEA-01, R-LEA-03, R-LEA-04.
 */
describe('LeaveRoomUseCase', () => {
  let leaveRoomUseCase: LeaveRoomUseCase;
  const createMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const getPublicRoomsMock = jest.fn();
  const getByIdMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();
  const joinMock = jest.fn();
  const leaveMock = jest.fn<Promise<void>, [string, string]>();

  const VALID_PARAMS = new LeaveRoomParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    userId: '550e8400-e29b-41d4-a716-446655440000',
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
    leaveRoomUseCase = new LeaveRoomUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.leave with the room id and user id', async () => {
      leaveMock.mockResolvedValue(undefined);

      await leaveRoomUseCase.execute(VALID_PARAMS);

      expect(leaveMock).toHaveBeenCalledWith(
        VALID_PARAMS.roomId,
        VALID_PARAMS.userId,
      );
      expect(leaveMock).toHaveBeenCalledTimes(1);
    });

    it('should resolve with no value on success (R-LEA-01)', async () => {
      leaveMock.mockResolvedValue(undefined);

      await expect(
        leaveRoomUseCase.execute(VALID_PARAMS),
      ).resolves.toBeUndefined();
    });

    it('should propagate RoomMembershipNotFoundFailure (R-LEA-03)', async () => {
      leaveMock.mockRejectedValue(
        new RoomMembershipNotFoundFailure(
          VALID_PARAMS.roomId,
          VALID_PARAMS.userId,
        ),
      );

      await expect(leaveRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomMembershipNotFoundFailure,
      );
    });

    it('should propagate RoomOwnerCannotLeaveFailure (R-LEA-04)', async () => {
      leaveMock.mockRejectedValue(
        new RoomOwnerCannotLeaveFailure(VALID_PARAMS.roomId),
      );

      await expect(leaveRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        RoomOwnerCannotLeaveFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      leaveMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(leaveRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

describe('LeaveRoomParams', () => {
  it('should store roomId and userId as readonly fields', () => {
    const params = new LeaveRoomParams({
      roomId: 'room-id-value',
      userId: 'user-id-value',
    });

    expect(params.roomId).toBe('room-id-value');
    expect(params.userId).toBe('user-id-value');
  });
});
