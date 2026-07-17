import { DataSource, EntityManager, Repository } from 'typeorm';

import { RoomRepositoryImpl } from '../../../../src/room/data/repositories/room-repository.impl';
import { RoomOrmEntity } from '../../../../src/room/data/entities/room.orm-entity';
import { RoomMembershipOrmEntity } from '../../../../src/room/data/entities/room-membership.orm-entity';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';
import { UpdateRoomParams } from '../../../../src/room/domain/usecases/update-room.params';
import {
  RoomNotFoundFailure,
  RoomAlreadyJoinedFailure,
  RoomMembershipNotFoundFailure,
  RoomOwnerCannotLeaveFailure,
} from '../../../../src/room/domain/failures/room.failure';

/**
 * Targeted unit tests for RoomRepositoryImpl.
 *
 * Unlike other `*RepositoryImpl` classes in this codebase, this file
 * exists to cover exactly one thing that no integration test can: that
 * `create()` genuinely runs inside a single `dataSource.transaction`
 * call, rather than as two independent `save()` calls that happen to
 * both succeed on the nominal path. A real database cannot easily be
 * made to fail *only* the second insert after the first has already
 * succeeded, so this behavior is verified here with a mocked
 * `DataSource`/`EntityManager` instead.
 *
 * `findOwnerId()` is covered here too for the same reason it needs no
 * database round-trip to verify its `null`-mapping branch.
 *
 * All other behavior of this class (actual persistence, constraints,
 * soft-delete filtering) remains the responsibility of
 * `room-repository.impl.integration.spec.ts`, per the project's
 * established convention of testing thin ORM adapters against a real
 * database rather than through extensive mocking.
 *
 * @competency Unit test harness targeting a specific regression risk.
 * @competency Verifying transactional integrity of persisted data.
 */
describe('RoomRepositoryImpl (unit)', () => {
  let repository: RoomRepositoryImpl;
  let transactionMock: jest.Mock;
  let managerCreateMock: jest.Mock;
  let managerSaveMock: jest.Mock;
  let dataSource: DataSource;

  const VALID_PARAMS = new CreateRoomParams({
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    isPublic: true,
  });

  beforeEach(() => {
    managerCreateMock = jest.fn(
      (_entityClass: unknown, data: Record<string, unknown>) => data,
    );
    managerSaveMock = jest.fn();

    const manager = {
      create: managerCreateMock,
      save: managerSaveMock,
    } as unknown as EntityManager;

    transactionMock = jest.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(manager),
    );

    dataSource = {
      transaction: transactionMock,
      getRepository: jest.fn(),
    } as unknown as DataSource;

    repository = new RoomRepositoryImpl(dataSource);
  });

  describe('create', () => {
    it('should perform both inserts within a single dataSource.transaction call', async () => {
      managerSaveMock
        .mockResolvedValueOnce({
          id: 'room-uuid',
          name: VALID_PARAMS.name,
          description: VALID_PARAMS.description,
          ownerId: VALID_PARAMS.ownerId,
          isPublic: VALID_PARAMS.isPublic,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        })
        .mockResolvedValueOnce({ id: 'membership-uuid' });

      await repository.create(VALID_PARAMS);

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(managerSaveMock).toHaveBeenCalledTimes(2);
    });

    it('should create the room before the membership, referencing the saved room id', async () => {
      managerSaveMock.mockImplementationOnce(
        (_entityClass: unknown, data: { id?: string }) =>
          Promise.resolve({
            ...data,
            id: 'room-uuid',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          }),
      );
      managerSaveMock.mockImplementationOnce((_entityClass: unknown, data) =>
        Promise.resolve(data),
      );

      await repository.create(VALID_PARAMS);

      expect(managerCreateMock).toHaveBeenNthCalledWith(
        1,
        RoomOrmEntity,
        expect.objectContaining({
          name: VALID_PARAMS.name,
          ownerId: VALID_PARAMS.ownerId,
        }),
      );
      expect(managerCreateMock).toHaveBeenNthCalledWith(
        2,
        RoomMembershipOrmEntity,
        expect.objectContaining({
          roomId: 'room-uuid',
          userId: VALID_PARAMS.ownerId,
        }),
      );
    });

    it('should propagate a failure in the membership insert without returning a fabricated result', async () => {
      managerSaveMock
        .mockResolvedValueOnce({
          id: 'room-uuid',
          name: VALID_PARAMS.name,
          description: VALID_PARAMS.description,
          ownerId: VALID_PARAMS.ownerId,
          isPublic: VALID_PARAMS.isPublic,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        })
        .mockRejectedValueOnce(new Error('unique_violation'));

      await expect(repository.create(VALID_PARAMS)).rejects.toThrow(
        'unique_violation',
      );
    });

    it('should never call manager.save outside of dataSource.transaction', async () => {
      managerSaveMock
        .mockResolvedValueOnce({
          id: 'room-uuid',
          name: VALID_PARAMS.name,
          description: VALID_PARAMS.description,
          ownerId: VALID_PARAMS.ownerId,
          isPublic: VALID_PARAMS.isPublic,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        })
        .mockResolvedValueOnce({ id: 'membership-uuid' });

      await repository.create(VALID_PARAMS);

      // Every save() call must have happened as part of the single
      // transaction() invocation — i.e. transaction() must have been
      // called before any save(), never the reverse.
      const transactionCallOrder = transactionMock.mock.invocationCallOrder[0];
      const saveCallOrders = managerSaveMock.mock.invocationCallOrder;

      expect(
        saveCallOrders.every((order) => order > transactionCallOrder),
      ).toBe(true);
    });
  });

  describe('findOwnerId', () => {
    it('should return the owner id when the room repository resolves a row', async () => {
      const findOneMock = jest
        .fn()
        .mockResolvedValue({ ownerId: 'owner-uuid' });
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: findOneMock,
      } as unknown as Repository<RoomOrmEntity>);

      const result = await repository.findOwnerId('room-uuid');

      expect(result).toBe('owner-uuid');
      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: 'room-uuid' },
        select: ['ownerId'],
      });
    });

    it('should return null when no row resolves (non-existent or soft-deleted room)', async () => {
      const findOneMock = jest.fn().mockResolvedValue(null);
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: findOneMock,
      } as unknown as Repository<RoomOrmEntity>);

      const result = await repository.findOwnerId('unknown-uuid');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const EXISTING_ROOM = {
      id: 'room-uuid',
      name: 'Friday Movie Night',
      description: 'Weekly watch party',
      ownerId: '550e8400-e29b-41d4-a716-446655440000',
      isPublic: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    function mockRoomRepositoryAndMembershipCount(
      foundRoom: typeof EXISTING_ROOM | null,
      memberCount = 2,
    ): {
      findOneMock: jest.Mock<Promise<typeof EXISTING_ROOM | null>, []>;
      saveMock: jest.Mock<
        Promise<typeof EXISTING_ROOM>,
        [typeof EXISTING_ROOM]
      >;
      countMock: jest.Mock<Promise<number>, []>;
    } {
      const findOneMock = jest
        .fn<Promise<typeof EXISTING_ROOM | null>, []>()
        .mockResolvedValue(foundRoom);
      const saveMock = jest
        .fn<Promise<typeof EXISTING_ROOM>, [typeof EXISTING_ROOM]>()
        .mockImplementation((room) =>
          Promise.resolve({
            ...room,
            updatedAt: new Date('2026-01-05T00:00:00Z'),
          }),
        );
      const countMock = jest
        .fn<Promise<number>, []>()
        .mockResolvedValue(memberCount);

      (dataSource.getRepository as jest.Mock).mockImplementation(
        (entityClass: unknown) => {
          if (entityClass === RoomMembershipOrmEntity) {
            return {
              count: countMock,
            } as unknown as Repository<RoomMembershipOrmEntity>;
          }
          return {
            findOne: findOneMock,
            save: saveMock,
          } as unknown as Repository<RoomOrmEntity>;
        },
      );

      return { findOneMock, saveMock, countMock };
    }

    it('should throw RoomNotFoundFailure when the room does not exist or is soft-deleted (R-UPD-06)', async () => {
      mockRoomRepositoryAndMembershipCount(null);

      await expect(
        repository.update(
          new UpdateRoomParams({ roomId: 'unknown-uuid', name: 'New Name' }),
        ),
      ).rejects.toThrow(RoomNotFoundFailure);
    });

    it('should apply only the provided field when name alone is supplied', async () => {
      const { saveMock } = mockRoomRepositoryAndMembershipCount({
        ...EXISTING_ROOM,
      });

      await repository.update(
        new UpdateRoomParams({ roomId: 'room-uuid', name: 'Renamed Room' }),
      );

      const savedRoom = saveMock.mock.calls[0][0];
      expect(savedRoom.name).toBe('Renamed Room');
      expect(savedRoom.description).toBe(EXISTING_ROOM.description);
    });

    it('should apply only the provided field when description alone is supplied (R-UPD-02)', async () => {
      const { saveMock } = mockRoomRepositoryAndMembershipCount({
        ...EXISTING_ROOM,
      });

      await repository.update(
        new UpdateRoomParams({
          roomId: 'room-uuid',
          description: 'New description only',
        }),
      );

      const savedRoom = saveMock.mock.calls[0][0];
      expect(savedRoom.name).toBe(EXISTING_ROOM.name);
      expect(savedRoom.description).toBe('New description only');
    });

    it('should return the updated room with the active member count (R-UPD-01)', async () => {
      mockRoomRepositoryAndMembershipCount({ ...EXISTING_ROOM }, 3);

      const result = await repository.update(
        new UpdateRoomParams({ roomId: 'room-uuid', name: 'Renamed Room' }),
      );

      expect(result.name).toBe('Renamed Room');
      expect(result.memberCount).toBe(3);
    });
  });

  describe('delete', () => {
    it('should call softDelete with the room id', async () => {
      const softDeleteMock = jest.fn().mockResolvedValue({ affected: 1 });
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        softDelete: softDeleteMock,
      } as unknown as Repository<RoomOrmEntity>);

      await repository.delete('room-uuid');

      expect(softDeleteMock).toHaveBeenCalledWith('room-uuid');
    });

    it('should throw RoomNotFoundFailure when no row is affected (already deleted or non-existent) (R-DEL-05)', async () => {
      const softDeleteMock = jest.fn().mockResolvedValue({ affected: 0 });
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        softDelete: softDeleteMock,
      } as unknown as Repository<RoomOrmEntity>);

      await expect(repository.delete('unknown-uuid')).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should resolve with no value on success', async () => {
      const softDeleteMock = jest.fn().mockResolvedValue({ affected: 1 });
      (dataSource.getRepository as jest.Mock).mockReturnValue({
        softDelete: softDeleteMock,
      } as unknown as Repository<RoomOrmEntity>);

      await expect(repository.delete('room-uuid')).resolves.toBeUndefined();
    });
  });

  describe('join', () => {
    const ROOM_ID = 'room-uuid';
    const USER_ID = 'user-uuid';
    const EXISTING_ROOM = {
      id: ROOM_ID,
      name: 'Friday Movie Night',
      description: 'Weekly watch party',
      ownerId: 'owner-uuid',
      isPublic: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    function mockJoinRepositories(options: {
      room?: typeof EXISTING_ROOM | null;
      existingActiveMembership?: unknown;
      saveError?: { code: string };
      memberCount?: number;
    }): {
      roomFindOneMock: jest.Mock;
      membershipFindOneMock: jest.Mock;
      membershipCreateMock: jest.Mock;
      membershipSaveMock: jest.Mock;
      membershipCountMock: jest.Mock;
    } {
      const roomFindOneMock = jest
        .fn()
        .mockResolvedValue(
          options.room === undefined ? EXISTING_ROOM : options.room,
        );
      const membershipFindOneMock = jest
        .fn()
        .mockResolvedValue(options.existingActiveMembership ?? null);
      const membershipCreateMock = jest
        .fn()
        .mockImplementation((data: unknown) => data);
      const membershipSaveMock =
        options.saveError !== undefined
          ? jest.fn().mockRejectedValue(options.saveError)
          : jest.fn().mockResolvedValue(undefined);
      const membershipCountMock = jest
        .fn()
        .mockResolvedValue(options.memberCount ?? 1);

      (dataSource.getRepository as jest.Mock).mockImplementation(
        (entityClass: unknown) => {
          if (entityClass === RoomMembershipOrmEntity) {
            return {
              findOne: membershipFindOneMock,
              create: membershipCreateMock,
              save: membershipSaveMock,
              count: membershipCountMock,
            } as unknown as Repository<RoomMembershipOrmEntity>;
          }
          return {
            findOne: roomFindOneMock,
          } as unknown as Repository<RoomOrmEntity>;
        },
      );

      return {
        roomFindOneMock,
        membershipFindOneMock,
        membershipCreateMock,
        membershipSaveMock,
        membershipCountMock,
      };
    }

    it('should throw RoomNotFoundFailure when the room does not exist or is soft-deleted (R-JOI-04)', async () => {
      mockJoinRepositories({ room: null });

      await expect(repository.join(ROOM_ID, USER_ID)).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should throw RoomAlreadyJoinedFailure when an active membership already exists (R-JOI-03, pre-check)', async () => {
      mockJoinRepositories({
        existingActiveMembership: { id: 'membership-uuid', leftAt: null },
      });

      await expect(repository.join(ROOM_ID, USER_ID)).rejects.toThrow(
        RoomAlreadyJoinedFailure,
      );
    });

    it('should throw RoomAlreadyJoinedFailure on a unique constraint violation during insert (race condition defense)', async () => {
      mockJoinRepositories({ saveError: { code: '23505' } });

      await expect(repository.join(ROOM_ID, USER_ID)).rejects.toThrow(
        RoomAlreadyJoinedFailure,
      );
    });

    it('should propagate an unrelated database error without masking it as RoomAlreadyJoinedFailure', async () => {
      mockJoinRepositories({ saveError: { code: '23503' } });

      await expect(repository.join(ROOM_ID, USER_ID)).rejects.not.toThrow(
        RoomAlreadyJoinedFailure,
      );
    });

    it('should return the room with the refreshed active member count on success (R-JOI-01)', async () => {
      mockJoinRepositories({ memberCount: 4 });

      const result = await repository.join(ROOM_ID, USER_ID);

      expect(result.id).toBe(ROOM_ID);
      expect(result.memberCount).toBe(4);
    });
  });

  describe('leave', () => {
    const ROOM_ID = 'room-uuid';
    const OWNER_ID = 'owner-uuid';
    const MEMBER_ID = 'member-uuid';
    const EXISTING_ROOM = {
      id: ROOM_ID,
      name: 'Friday Movie Night',
      description: 'Weekly watch party',
      ownerId: OWNER_ID,
      isPublic: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    function mockLeaveRepositories(options: {
      room?: typeof EXISTING_ROOM | null;
      activeMembership?: { id: string; leftAt: null } | null;
    }): {
      roomFindOneMock: jest.Mock;
      membershipFindOneMock: jest.Mock;
      membershipSaveMock: jest.Mock<
        Promise<{ leftAt: Date | null }>,
        [{ leftAt: Date | null }]
      >;
    } {
      const roomFindOneMock = jest
        .fn()
        .mockResolvedValue(
          options.room === undefined ? EXISTING_ROOM : options.room,
        );
      const membershipFindOneMock = jest
        .fn()
        .mockResolvedValue(
          options.activeMembership === undefined
            ? { id: 'membership-uuid', leftAt: null }
            : options.activeMembership,
        );
      const membershipSaveMock = jest
        .fn<Promise<{ leftAt: Date | null }>, [{ leftAt: Date | null }]>()
        .mockImplementation((membership) => Promise.resolve(membership));

      (dataSource.getRepository as jest.Mock).mockImplementation(
        (entityClass: unknown) => {
          if (entityClass === RoomMembershipOrmEntity) {
            return {
              findOne: membershipFindOneMock,
              save: membershipSaveMock,
            } as unknown as Repository<RoomMembershipOrmEntity>;
          }
          return {
            findOne: roomFindOneMock,
          } as unknown as Repository<RoomOrmEntity>;
        },
      );

      return { roomFindOneMock, membershipFindOneMock, membershipSaveMock };
    }

    it('should throw RoomNotFoundFailure when the room does not exist or is soft-deleted', async () => {
      mockLeaveRepositories({ room: null });

      await expect(repository.leave(ROOM_ID, MEMBER_ID)).rejects.toThrow(
        RoomNotFoundFailure,
      );
    });

    it('should throw RoomOwnerCannotLeaveFailure when the requesting user is the room owner (R-LEA-04)', async () => {
      mockLeaveRepositories({});

      await expect(repository.leave(ROOM_ID, OWNER_ID)).rejects.toThrow(
        RoomOwnerCannotLeaveFailure,
      );
    });

    it('should throw RoomMembershipNotFoundFailure when the user has no active membership (R-LEA-03)', async () => {
      mockLeaveRepositories({ activeMembership: null });

      await expect(repository.leave(ROOM_ID, MEMBER_ID)).rejects.toThrow(
        RoomMembershipNotFoundFailure,
      );
    });

    it('should set left_at on the active membership on success (R-LEA-01)', async () => {
      const { membershipSaveMock } = mockLeaveRepositories({});

      await repository.leave(ROOM_ID, MEMBER_ID);

      const savedMembership = membershipSaveMock.mock.calls[0][0];
      expect(savedMembership.leftAt).not.toBeNull();
      expect(savedMembership.leftAt).toBeInstanceOf(Date);
    });

    it('should resolve with no value on success', async () => {
      mockLeaveRepositories({});

      await expect(
        repository.leave(ROOM_ID, MEMBER_ID),
      ).resolves.toBeUndefined();
    });
  });
});
