/**
 * VideoSession — domain entity of the Video Synchronisation bounded
 * context, backend side.
 *
 * Represents the persistent record of "a video has been added to this
 * room," with its cached YouTube metadata. This is intentionally a
 * narrower model than the frontend's `VideoSessionEntity`
 * : the backend has no notion of `isPlaying`,
 * `currentPosition`, or `leaderId` — those fields exist only in
 * Firebase and are never written to or read from PostgreSQL. Conflating
 * the two would blur the boundary the data model deliberately draws
 * between the persistent and ephemeral synchronization layers.
 */
export class VideoSessionEntity {
  readonly id: string;
  readonly roomId: string;
  readonly youtubeVideoId: string;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly durationSeconds: number;
  readonly addedBy: string;
  readonly createdAt: Date;

  constructor(props: {
    id: string;
    roomId: string;
    youtubeVideoId: string;
    title: string;
    thumbnailUrl: string | null;
    durationSeconds: number;
    addedBy: string;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.roomId = props.roomId;
    this.youtubeVideoId = props.youtubeVideoId;
    this.title = props.title;
    this.thumbnailUrl = props.thumbnailUrl;
    this.durationSeconds = props.durationSeconds;
    this.addedBy = props.addedBy;
    this.createdAt = props.createdAt;
  }
}
