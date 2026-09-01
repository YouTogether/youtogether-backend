import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';

import {
  InvalidYoutubeVideoIdFailure,
  RealtimeStateUnavailableFailure,
  VideoSessionNotFoundFailure,
  YoutubeApiUnavailableFailure,
  YoutubeVideoNotFoundFailure,
} from '../../../../src/video-sync/domain/failures/video-session.failure';
import { VideoSessionExceptionFilter } from '../../../../src/video-sync/presentation/filters/video-session-exception.filter';

/**
 * Unit tests for VideoSessionExceptionFilter.
 *
 * Mirrors `room-exception.filter.spec.ts`: the filter's own `catch()`
 * is invoked against a mocked `ArgumentsHost`/`Response`, giving direct
 * coverage of the mapping logic rather than of NestJS's
 * `HttpException` behaviour.
 *
 * This suite was missing until B-V03 — the filter's mappings were only
 * ever asserted indirectly, through the status codes returned by the
 * `create-video-session` and `get-video-session` integration suites.
 * That indirection is workable for a mapping already exercised by an
 * HTTP route, but it leaves no direct evidence of the mapping table
 * itself, and it cannot distinguish "the filter maps this failure to
 * 502" from "some other layer produced a 502". Adding the file here
 * rather than in a separate ticket is deliberate: B-V03 extends this
 * filter's `@Catch` list, and extending an untested mapping table is
 * how mapping tables quietly drift.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios VS-CRE-02, VS-CRE-06, VS-GET-02.
 */
describe('VideoSessionExceptionFilter', () => {
  let filter: VideoSessionExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  const ROOM_ID = '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f';

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    const response = { status: statusMock } as unknown as Response;

    host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    filter = new VideoSessionExceptionFilter();
  });

  it('should map InvalidYoutubeVideoIdFailure to a 400 status (VS-CRE-02)', () => {
    filter.catch(new InvalidYoutubeVideoIdFailure('not-11-chars'), host);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('should map YoutubeVideoNotFoundFailure to a 400 status', () => {
    filter.catch(new YoutubeVideoNotFoundFailure('zzzzzzzzzzz'), host);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('should map VideoSessionNotFoundFailure to a 404 status (VS-GET-02)', () => {
    filter.catch(new VideoSessionNotFoundFailure(ROOM_ID), host);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('should map YoutubeApiUnavailableFailure to a 502 status', () => {
    filter.catch(new YoutubeApiUnavailableFailure('quota exceeded'), host);

    expect(statusMock).toHaveBeenCalledWith(502);
  });

  it('should map RealtimeStateUnavailableFailure to a 502 status (VS-CRE-06)', () => {
    filter.catch(
      new RealtimeStateUnavailableFailure('permission_denied'),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(502);
  });

  it("should include the failure's message in the JSON body", () => {
    const failure = new RealtimeStateUnavailableFailure('permission_denied');

    filter.catch(failure, host);

    const [jsonBody] = jsonMock.mock.calls[0] as [{ message: string }];
    expect(jsonBody.message).toBe(failure.message);
  });

  it('should not leak the video id of a rejected input beyond the failure message', () => {
    // The message intentionally echoes the submitted id, which is
    // caller-supplied and non-sensitive. What must not appear is any
    // additional field carrying it as structured data, since error
    // bodies are the part of the response most likely to end up in
    // client-side logs.
    filter.catch(new InvalidYoutubeVideoIdFailure('not-11-chars'), host);

    const [jsonBody] = jsonMock.mock.calls[0] as [Record<string, unknown>];
    expect(jsonBody.youtubeVideoId).toBeUndefined();
  });
});
