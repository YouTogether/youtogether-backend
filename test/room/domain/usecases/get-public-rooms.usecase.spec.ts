import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { GetPublicRoomsUseCase } from '../../../../src/room/domain/usecases/get-public-rooms.usecase';

/**
 * Unit tests for GetPublicRoomsUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.getPublicRooms}, mirroring
 * `create-room.usecase.spec.ts`. Takes no params — listing public rooms
 * requires no input beyond the implicit "public, active" filter.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenario groundwork for R-LST-01 through R-LST-07.
 */
describe('GetPublicRoomsUseCase', () => {
  let getPublicRoomsUseCase: GetPublicRoomsUseCase;
  const getPublicRoomsMock = jest.fn<Promise<RoomEntity[]>, []>();
  const createMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const getByIdMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();
  const joinMock = jest.fn();
  const leaveMock = jest.fn();

  const MOCK_ROOMS = [
    new RoomEntity({
      id: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
      name: 'Friday Movie Night',
      description: 'Weekly watch party',
      ownerId: '550e8400-e29b-41d4-a716-446655440000',
      isPublic: true,
      memberCount: 3,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }),
    new RoomEntity({
      id: '8c3f7c1b-3f3b-5c7b-9f3b-2b3c4d5e6f70',
      name: 'Saturday Anime Marathon',
      description: null,
      ownerId: '660e8400-e29b-41d4-a716-446655440001',
      isPublic: true,
      memberCount: 1,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    }),
  ];

  beforeEach(() => {
    getPublicRoomsMock.mockReset();
    createMock.mockReset();
    findOwnerIdMock.mockReset();
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
    getPublicRoomsUseCase = new GetPublicRoomsUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.getPublicRooms', async () => {
      getPublicRoomsMock.mockResolvedValue(MOCK_ROOMS);

      await getPublicRoomsUseCase.execute();

      expect(getPublicRoomsMock).toHaveBeenCalledTimes(1);
      expect(getPublicRoomsMock).toHaveBeenCalledWith();
    });

    it('should return the list of RoomEntity provided by the repository', async () => {
      getPublicRoomsMock.mockResolvedValue(MOCK_ROOMS);

      const result = await getPublicRoomsUseCase.execute();

      expect(result).toBe(MOCK_ROOMS);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no public rooms exist (R-LST-06)', async () => {
      getPublicRoomsMock.mockResolvedValue([]);

      const result = await getPublicRoomsUseCase.execute();

      expect(result).toEqual([]);
    });

    it('should not catch or transform unexpected errors', async () => {
      getPublicRoomsMock.mockRejectedValue(new Error('Database unavailable'));

      await expect(getPublicRoomsUseCase.execute()).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});
