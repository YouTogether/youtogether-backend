import {
  RoomNotFoundFailure,
  RoomAlreadyJoinedFailure,
} from '../../../../src/room/domain/failures/room.failure';

/**
 * Unit tests for RoomNotFoundFailure.
 *
 * Mirrors `auth.failure.spec.ts`'s treatment of `UserNotFoundFailure`:
 * a plain Error subclass carrying the identifying field the presentation
 * layer's exception filter needs to build its HTTP response.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-DET-02, R-DET-03 (not found / deleted room).
 */
describe('RoomNotFoundFailure', () => {
  it('should extend Error with the correct name, message, and roomId', () => {
    const failure = new RoomNotFoundFailure(
      '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(RoomNotFoundFailure);
    expect(failure.name).toBe('RoomNotFoundFailure');
    expect(failure.roomId).toBe('7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f');
    expect(failure.message).toBe(
      'Room with id "7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f" was not found.',
    );
  });
});

/**
 * @competency Test scenario R-JOI-03 (duplicate active membership).
 */
describe('RoomAlreadyJoinedFailure', () => {
  it('should extend Error with the correct name, message, roomId, and userId', () => {
    const failure = new RoomAlreadyJoinedFailure(
      '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(RoomAlreadyJoinedFailure);
    expect(failure.name).toBe('RoomAlreadyJoinedFailure');
    expect(failure.roomId).toBe('7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f');
    expect(failure.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(failure.message).toBe(
      'User "550e8400-e29b-41d4-a716-446655440000" already has an active membership in room "7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f".',
    );
  });
});
