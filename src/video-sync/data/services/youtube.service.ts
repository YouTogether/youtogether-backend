import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { VideoMetadata } from '../../domain/repositories/video-session-repository.interface';
import {
  YoutubeApiUnavailableFailure,
  YoutubeVideoNotFoundFailure,
} from '../../domain/failures/video-session.failure';

interface YouTubeVideosListResponse {
  items: Array<{
    snippet: {
      title: string;
      thumbnails?: Record<string, { url: string } | undefined>;
    };
    contentDetails: {
      duration: string;
    };
  }>;
}

/**
 * Integration service for the YouTube Data API v3 `videos.list` endpoint.
 *
 * Fetches and normalizes the metadata (title, thumbnail, duration)
 * cached by {@link IVideoSessionRepository.create} at video session
 * creation. Uses the platform `fetch` rather than `@nestjs/axios`, since
 * this is the only outbound HTTP call in the backend and a full HTTP
 * client module was judged disproportionate for it.
 *
 * Requires the `YOUTUBE_API_KEY` environment variable.
 *
 * @competency Evolvable, secure integration with an external dependency
 */
@Injectable()
export class YouTubeService {
  private static readonly API_URL =
    'https://www.googleapis.com/youtube/v3/videos';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Fetches and normalises metadata for a single YouTube video.
   *
   * @param youtubeVideoId - An 11-character YouTube video id. Assumed
   *   already format-validated by the caller (DTO validation runs
   *   before this service is invoked).
   * @throws {YoutubeVideoNotFoundFailure} if the API returns no matching video.
   * @throws {YoutubeApiUnavailableFailure} on a non-OK response or network error.
   */
  async fetchMetadata(youtubeVideoId: string): Promise<VideoMetadata> {
    const apiKey = this.configService.getOrThrow<string>('YOUTUBE_API_KEY');

    const url = new URL(YouTubeService.API_URL);
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('id', youtubeVideoId);
    url.searchParams.set('key', apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (error) {
      throw new YoutubeApiUnavailableFailure(
        error instanceof Error ? error.message : 'unknown network error',
      );
    }

    if (!response.ok) {
      throw new YoutubeApiUnavailableFailure(
        `${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as YouTubeVideosListResponse;

    if (body.items.length === 0) {
      throw new YoutubeVideoNotFoundFailure(youtubeVideoId);
    }

    const [video] = body.items;
    const thumbnailUrl = this.selectBestThumbnail(video.snippet.thumbnails);

    return {
      title: video.snippet.title,
      thumbnailUrl,
      durationSeconds: this.parseIso8601Duration(video.contentDetails.duration),
    };
  }

  /**
   * Prefers the highest-resolution thumbnail available, falling back
   * through YouTube's documented quality order, and to `null` if the
   * snippet carries no thumbnails at all.
   */
  private selectBestThumbnail(
    thumbnails: Record<string, { url: string } | undefined> | undefined,
  ): string | null {
    if (thumbnails === undefined) {
      return null;
    }
    const preferredOrder = ['maxres', 'high', 'medium', 'default'];
    for (const quality of preferredOrder) {
      const candidate = thumbnails[quality];
      if (candidate !== undefined) {
        return candidate.url;
      }
    }
    return null;
  }

  /**
   * Parses an ISO 8601 duration (`PT#H#M#S`, any component optional) into
   * a total number of seconds.
   */
  private parseIso8601Duration(iso8601Duration: string): number {
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso8601Duration);
    const hours = match?.[1] !== undefined ? parseInt(match[1], 10) : 0;
    const minutes = match?.[2] !== undefined ? parseInt(match[2], 10) : 0;
    const seconds = match?.[3] !== undefined ? parseInt(match[3], 10) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
}
