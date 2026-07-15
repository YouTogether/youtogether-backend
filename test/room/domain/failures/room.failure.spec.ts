import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';

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
