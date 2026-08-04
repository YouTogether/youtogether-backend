import { ConfigService } from '@nestjs/config';

import { YouTubeService } from '../../../../src/video-sync/data/services/youtube.service';
import {
  YoutubeApiUnavailableFailure,
  YoutubeVideoNotFoundFailure,
} from '../../../../src/video-sync/domain/failures/video-session.failure';

/**
 * Unit tests for YouTubeService.fetchMetadata.
 *
 * `global.fetch` is stubbed directly rather than mocking an HTTP client
 * library: the service uses the platform `fetch` (available on the
 * Node.js runtime versions this project targets) to avoid adding a
 * dependency solely for one outbound call, mirroring the project's
 * general preference for minimal dependencies (`lefthook` over
 * `husky`, `release-please` over `semantic-release`).
 *
 * @competency Unit test harness.
 * @competency Test scenarios (metadata fetched),
 * (not found), and error handling for quota/network failures.
 */

/**
 * Minimal shape of the `fetch` Response this suite stubs — only the
 * members `YouTubeService.fetchMetadata` actually reads. Typing the mock
 * against this (rather than leaving it as an untyped `jest.fn()`) is
 * what lets `fetchMock.mock.calls[0][0]` resolve to `string` instead of
 * `any`, satisfying `@typescript-eslint/no-unsafe-member-access`.
 */
interface FakeFetchResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}

describe('YouTubeService', () => {
  let service: YouTubeService;
  let configService: ConfigService;
  let fetchMock: jest.Mock<Promise<FakeFetchResponse>, [string]>;

  const VALID_ID = 'dQw4w9WgXcQ';

  function apiResponse(overrides: Record<string, unknown> = {}): unknown {
    return {
      items: [
        {
          snippet: {
            title: 'Never Gonna Give You Up',
            thumbnails: {
              high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
            },
          },
          contentDetails: {
            duration: 'PT3M33S',
          },
          ...overrides,
        },
      ],
    };
  }

  beforeEach(() => {
    fetchMock = jest.fn<Promise<FakeFetchResponse>, [string]>();
    global.fetch = fetchMock as unknown as typeof fetch;

    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-youtube-api-key'),
    } as unknown as ConfigService;

    service = new YouTubeService(configService);
  });

  it('should call the YouTube Data API v3 videos.list endpoint with the correct parameters', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse()),
    });

    await service.fetchMetadata(VALID_ID);

    const [calledUrlArg] = fetchMock.mock.calls[0];
    const calledUrl = new URL(calledUrlArg);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://www.googleapis.com/youtube/v3/videos',
    );
    expect(calledUrl.searchParams.get('part')).toBe('snippet,contentDetails');
    expect(calledUrl.searchParams.get('id')).toBe(VALID_ID);
    expect(calledUrl.searchParams.get('key')).toBe('test-youtube-api-key');
  });

  it('should extract title and thumbnail from the snippet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse()),
    });

    const metadata = await service.fetchMetadata(VALID_ID);

    expect(metadata.title).toBe('Never Gonna Give You Up');
    expect(metadata.thumbnailUrl).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
  });

  it('should parse an ISO 8601 duration (PT#H#M#S) into total seconds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          apiResponse({ contentDetails: { duration: 'PT1H2M10S' } }),
        ),
    });

    const metadata = await service.fetchMetadata(VALID_ID);

    expect(metadata.durationSeconds).toBe(1 * 3600 + 2 * 60 + 10);
  });

  it('should parse an ISO 8601 duration with only minutes and seconds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse()),
    });

    const metadata = await service.fetchMetadata(VALID_ID);

    expect(metadata.durationSeconds).toBe(3 * 60 + 33);
  });

  it('should default thumbnailUrl to null when no thumbnail is present', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          apiResponse({
            snippet: { title: 'No Thumbnail Video', thumbnails: {} },
          }),
        ),
    });

    const metadata = await service.fetchMetadata(VALID_ID);

    expect(metadata.thumbnailUrl).toBeNull();
  });

  it('should throw YoutubeVideoNotFoundFailure when the API returns an empty items array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    await expect(service.fetchMetadata('zzzzzzzzzzz')).rejects.toThrow(
      YoutubeVideoNotFoundFailure,
    );
  });

  it('should throw YoutubeApiUnavailableFailure when the API responds with a non-OK status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden — quota exceeded',
    });

    await expect(service.fetchMetadata(VALID_ID)).rejects.toThrow(
      YoutubeApiUnavailableFailure,
    );
  });

  it('should throw YoutubeApiUnavailableFailure on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('network unreachable'));

    await expect(service.fetchMetadata(VALID_ID)).rejects.toThrow(
      YoutubeApiUnavailableFailure,
    );
  });
});
