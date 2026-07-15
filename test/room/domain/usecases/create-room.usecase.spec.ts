import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';
import { CreateRoomUseCase } from '../../../../src/room/domain/usecases/create-room.usecase';

/**
 * Unit tests for CreateRoomUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation to
 * {@link IRoomRepository.create}, mirroring `register.usecase.spec.ts`.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenario R-CRE-01 (creation delegation).
 */
describe('CreateRoomUseCase', () => {
  let createRoomUseCase: CreateRoomUseCase;
  const createMock = jest.fn<Promise<RoomEntity>, [CreateRoomParams]>();

  const VALID_PARAMS = new CreateRoomParams({
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    isPublic: true,
  });

  const MOCK_ROOM = new RoomEntity({
    id: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    ownerId: VALID_PARAMS.ownerId,
    isPublic: true,
    memberCount: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

  const findOwnerIdMock = jest.fn<Promise<string | null>, [string]>();
  const getPublicRoomsMock = jest.fn<Promise<RoomEntity[]>, []>();
  const getByIdMock = jest.fn<Promise<RoomEntity>, [string]>();

  beforeEach(() => {
    createMock.mockReset();
    findOwnerIdMock.mockReset();
    getPublicRoomsMock.mockReset();
    getByIdMock.mockReset();
    const roomRepository: IRoomRepository = {
      create: createMock,
      findOwnerId: findOwnerIdMock,
      getPublicRooms: getPublicRoomsMock,
      getById: getByIdMock,
    };
    createRoomUseCase = new CreateRoomUseCase(roomRepository);
  });

  describe('execute', () => {
    it('should delegate to IRoomRepository.create with the provided params', async () => {
      createMock.mockResolvedValue(MOCK_ROOM);

      await createRoomUseCase.execute(VALID_PARAMS);

      expect(createMock).toHaveBeenCalledWith(VALID_PARAMS);
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    it('should return the RoomEntity provided by the repository', async () => {
      createMock.mockResolvedValue(MOCK_ROOM);

      const result = await createRoomUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_ROOM);
    });

    it('should not catch or transform unexpected errors', async () => {
      createMock.mockRejectedValue(new Error('Database connection lost'));

      await expect(createRoomUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});

describe('CreateRoomParams', () => {
  it('should store ownerId, name, description, and isPublic as readonly fields', () => {
    const params = new CreateRoomParams({
      ownerId: 'owner-uuid',
      name: 'Room Name',
      description: 'Some description',
      isPublic: false,
    });

    expect(params.ownerId).toBe('owner-uuid');
    expect(params.name).toBe('Room Name');
    expect(params.description).toBe('Some description');
    expect(params.isPublic).toBe(false);
  });

  it('should default description to null when omitted', () => {
    const params = new CreateRoomParams({
      ownerId: 'owner-uuid',
      name: 'Room Name',
      isPublic: true,
    });

    expect(params.description).toBeNull();
  });
});
