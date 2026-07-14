import { DataSource, EntityManager, Repository } from 'typeorm';

import { RoomRepositoryImpl } from '../../../../src/room/data/repositories/room-repository.impl';
import { RoomOrmEntity } from '../../../../src/room/data/entities/room.orm-entity';
import { RoomMembershipOrmEntity } from '../../../../src/room/data/entities/room-membership.orm-entity';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';

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
});
