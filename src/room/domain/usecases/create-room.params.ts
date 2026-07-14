/**
 * Input value object for {@link CreateRoomUseCase}.
 *
 * `ownerId` is always sourced from the authenticated request (via
 * `@CurrentUser`), never from client-supplied body fields — see
 * `RoomController.create`.
 *
 * @see CreateRoomUseCase
 * @see IRoomRepository.create
 */
export class CreateRoomParams {
  readonly ownerId: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPublic: boolean;

  constructor(params: {
    ownerId: string;
    name: string;
    description?: string;
    isPublic: boolean;
  }) {
    this.ownerId = params.ownerId;
    this.name = params.name;
    this.description = params.description ?? null;
    this.isPublic = params.isPublic;
  }
}
