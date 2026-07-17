/**
 * Input value object for {@link JoinRoomUseCase}.
 *
 * `userId` always comes from the authenticated request (via
 * `@CurrentUser`), `roomId` from the route parameter — mirroring
 * `CreateRoomParams`.
 *
 * @see JoinRoomUseCase
 * @see IRoomRepository.join
 */
export class JoinRoomParams {
  readonly roomId: string;
  readonly userId: string;

  constructor(params: { roomId: string; userId: string }) {
    this.roomId = params.roomId;
    this.userId = params.userId;
  }
}
