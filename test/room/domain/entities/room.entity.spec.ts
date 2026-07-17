import { RoomEntity } from '../../../../src/room/domain/entities/room.entity';

/**
 * Unit tests for the domain RoomEntity.
 *
 * Validates construction and field assignment independently of any
 * persistence or framework concern, mirroring `user.entity.spec.ts`.
 *
 * @competency Unit test harness written before production code (TDD).
 */
describe('RoomEntity (domain)', () => {
  const validParams = {
    id: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    name: 'Friday Movie Night',
    description: 'Weekly watch party',
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
    isPublic: true,
    memberCount: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('should construct a RoomEntity with all provided fields', () => {
    const room = new RoomEntity(validParams);

    expect(room.id).toBe(validParams.id);
    expect(room.name).toBe(validParams.name);
    expect(room.description).toBe(validParams.description);
    expect(room.ownerId).toBe(validParams.ownerId);
    expect(room.isPublic).toBe(true);
    expect(room.memberCount).toBe(1);
    expect(room.createdAt).toEqual(validParams.createdAt);
    expect(room.updatedAt).toEqual(validParams.updatedAt);
  });

  it('should accept a null description', () => {
    const room = new RoomEntity({ ...validParams, description: null });

    expect(room.description).toBeNull();
  });

  it('should not expose deletedAt (soft-delete is a data-layer concern)', () => {
    const room = new RoomEntity(validParams);
    const roomRecord = room as unknown as Record<string, unknown>;

    expect(roomRecord.deletedAt).toBeUndefined();
  });
});
