/**
 * Input value object for {@link GetRoomByIdUseCase}.
 *
 * @see GetRoomByIdUseCase
 * @see IRoomRepository.getById
 */
export class GetRoomByIdParams {
  readonly roomId: string;

  constructor(params: { roomId: string }) {
    this.roomId = params.roomId;
  }
}
