/**
 * Input value object for {@link LeaveRoomUseCase}.
 *
 * Mirrors `JoinRoomParams`: `userId` comes from the authenticated
 * request, `roomId` from the route parameter.
 *
 * @see LeaveRoomUseCase
 * @see IRoomRepository.leave
 */
export class LeaveRoomParams {
  readonly roomId: string;
  readonly userId: string;

  constructor(params: { roomId: string; userId: string }) {
    this.roomId = params.roomId;
    this.userId = params.userId;
  }
}
