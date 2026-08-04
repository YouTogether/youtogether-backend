/**
 * Parameters for {@link CreateVideoSessionUseCase}.
 *
 * `addedBy` is always the authenticated user id resolved by
 * `@CurrentUser`, mirroring `CreateRoomParams.ownerId` — never taken
 * from client-supplied input.
 *
 * @see CreateVideoSessionUseCase
 */
export class CreateVideoSessionParams {
  readonly roomId: string;
  readonly youtubeVideoId: string;
  readonly addedBy: string;

  constructor(props: {
    roomId: string;
    youtubeVideoId: string;
    addedBy: string;
  }) {
    this.roomId = props.roomId;
    this.youtubeVideoId = props.youtubeVideoId;
    this.addedBy = props.addedBy;
  }
}
