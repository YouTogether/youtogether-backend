/**
 * Input value object for {@link UpdateRoomUseCase}.
 *
 * `name` and `description` are both optional to support partial updates
 * (PATCH semantics): a field left `undefined` means "leave unchanged",
 * distinct from an explicit empty value. `roomId` always comes from the
 * route parameter, already authorized by `OwnershipGuard` before this
 * value object is even constructed.
 *
 * @see UpdateRoomUseCase
 * @see IRoomRepository.update
 */
export class UpdateRoomParams {
  readonly roomId: string;
  readonly name?: string;
  readonly description?: string;

  constructor(params: { roomId: string; name?: string; description?: string }) {
    this.roomId = params.roomId;
    this.name = params.name;
    this.description = params.description;
  }
}
