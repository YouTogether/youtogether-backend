/**
 * Input value object for {@link DeleteRoomUseCase}.
 *
 * `roomId` always comes from the route parameter, already authorized by
 * `OwnershipGuard` before this value object is even constructed.
 *
 * @see DeleteRoomUseCase
 * @see IRoomRepository.delete
 */
export class DeleteRoomParams {
  readonly roomId: string;

  constructor(params: { roomId: string }) {
    this.roomId = params.roomId;
  }
}
