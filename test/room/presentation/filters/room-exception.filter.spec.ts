import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';

import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';
import { RoomExceptionFilter } from '../../../../src/room/presentation/filters/room-exception.filter';

/**
 * Unit tests for RoomExceptionFilter.
 *
 * Unlike `auth.controller.spec.ts`'s lightweight verification (which only
 * constructs an `HttpException` manually to check its status code), this
 * suite invokes the filter's own `catch()` method against a mocked
 * `ArgumentsHost`/`Response`, giving direct coverage of the mapping logic
 * itself rather than of NestJS's `HttpException` behavior.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios R-DET-02, R-DET-03 (404 mapping).
 */
describe('RoomExceptionFilter', () => {
  let filter: RoomExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    const response = { status: statusMock } as unknown as Response;

    host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    filter = new RoomExceptionFilter();
  });

  it('should map RoomNotFoundFailure to a 404 status', () => {
    const failure = new RoomNotFoundFailure(
      '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    );

    filter.catch(failure, host);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it("should include the failure's message in the JSON body", () => {
    const failure = new RoomNotFoundFailure(
      '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    );

    filter.catch(failure, host);

    const [jsonBody] = jsonMock.mock.calls[0] as [{ message: string }];
    expect(jsonBody.message).toBe(failure.message);
  });
});
