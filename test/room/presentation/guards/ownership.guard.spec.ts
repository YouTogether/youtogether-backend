import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { OwnershipGuard } from '../../../../src/room/presentation/guards/ownership.guard';
import { AuthenticatedUser } from '../../../../src/auth/presentation/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';

/**
 * Unit tests for OwnershipGuard (B-R04-T1 — presentation layer).
 *
 * IRoomRepository is mocked; only `findOwnerId` is exercised. Reused as-is
 * by the update (B-R04-T2) and delete (B-R05-T1) endpoints via
 * `@UseGuards(JwtAuthGuard, OwnershipGuard)`.
 *
 * @competency Unit test harness, TDD.
 * @competency Test scenarios R-UPD-05/06, R-DEL-04/05 (guard-level).
 */
describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  const findOwnerIdMock = jest.fn<Promise<string | null>, [string]>();

  const OWNER: AuthenticatedUser = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.REGISTERED,
  };

  const NON_OWNER: AuthenticatedUser = {
    userId: '11111111-1111-4111-8111-111111111111',
    role: UserRole.REGISTERED,
  };

  const ROOM_ID = '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f';

  const buildContext = (
    user: AuthenticatedUser,
    roomId: string,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, params: { id: roomId } }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    findOwnerIdMock.mockReset();
    const roomRepository: Pick<IRoomRepository, 'findOwnerId'> = {
      findOwnerId: findOwnerIdMock,
    };
    guard = new OwnershipGuard(roomRepository as IRoomRepository);
  });

  it('should allow the request when the authenticated user owns the room', async () => {
    findOwnerIdMock.mockResolvedValue(OWNER.userId);

    const result = await guard.canActivate(buildContext(OWNER, ROOM_ID));

    expect(result).toBe(true);
    expect(findOwnerIdMock).toHaveBeenCalledWith(ROOM_ID);
  });

  it('should throw ForbiddenException when the authenticated user does not own the room (R-UPD-05/R-DEL-04)', async () => {
    findOwnerIdMock.mockResolvedValue(OWNER.userId);

    await expect(
      guard.canActivate(buildContext(NON_OWNER, ROOM_ID)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException when the room does not exist or is soft-deleted (R-UPD-06/R-DEL-05)', async () => {
    findOwnerIdMock.mockResolvedValue(null);

    await expect(
      guard.canActivate(buildContext(OWNER, ROOM_ID)),
    ).rejects.toThrow(NotFoundException);
  });

  it('should not leak whether the room exists when access is denied for another reason', async () => {
    findOwnerIdMock.mockResolvedValue(OWNER.userId);

    await expect(
      guard.canActivate(buildContext(NON_OWNER, ROOM_ID)),
    ).rejects.not.toThrow(NotFoundException);
  });
});
