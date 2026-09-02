import { ArgumentsHost } from '@nestjs/common';

import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import {
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
  InvalidRefreshTokenFailure,
  UserNotFoundFailure,
} from '../../../../src/auth/domain/failures/auth.failure';
import { FirebaseTokenUnavailableFailure } from '../../../../src/auth/domain/failures/firebase-token.failure';

/**
 * Unit tests for DomainExceptionFilter.
 *
 * These invoke `filter.catch()` against a stubbed ArgumentsHost, so the
 * assertions verify the filter's own mapping table.
 *
 * The equivalent block inside `auth.controller.spec.ts` constructs a
 * `ConflictException` and asserts it carries status 409 — which tests
 * NestJS, not this filter. That block can stay as documentation of
 * intent; this file is what actually fails if a mapping is changed or
 * a failure is added to `@Catch()` without a branch to handle it.
 *
 * Mirrors `RoomExceptionFilter`'s and `VideoSessionExceptionFilter`'s
 * own specs in structure.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenario A-FBT-04.
 */
describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;

  const jsonMock = jest.fn();
  const statusMock = jest.fn();

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusMock, json: jsonMock }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jsonMock.mockReset();
    statusMock.mockReset();
    statusMock.mockReturnValue({ json: jsonMock });

    filter = new DomainExceptionFilter();
  });

  it('should map EmailAlreadyInUseFailure to 409 Conflict', () => {
    filter.catch(new EmailAlreadyInUseFailure('dup@example.com'), host);

    expect(statusMock).toHaveBeenCalledWith(409);
  });

  it('should name the conflicting email in the 409 body', () => {
    filter.catch(new EmailAlreadyInUseFailure('dup@example.com'), host);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('dup@example.com') as string,
      }),
    );
  });

  it('should map InvalidCredentialsFailure to 401 Unauthorized', () => {
    filter.catch(new InvalidCredentialsFailure(), host);

    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it('should map InvalidRefreshTokenFailure to 401 Unauthorized', () => {
    filter.catch(new InvalidRefreshTokenFailure(), host);

    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it('should map UserNotFoundFailure to 401 Unauthorized (A-FBT-02)', () => {
    filter.catch(new UserNotFoundFailure(), host);

    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it('should map FirebaseTokenUnavailableFailure to 502 Bad Gateway (A-FBT-04)', () => {
    // Not 500: nothing in this application is broken. Not 401: the
    // caller's credentials are valid and re-authenticating would not
    // help. Same treatment VideoSessionExceptionFilter gives
    // YoutubeApiUnavailableFailure.
    filter.catch(new FirebaseTokenUnavailableFailure('IAM denied'), host);

    expect(statusMock).toHaveBeenCalledWith(502);
  });

  it('should not reveal which credential was wrong in the 401 body', () => {
    // The anti-enumeration guarantee documented on
    // InvalidCredentialsFailure holds all the way to the wire, not just
    // in the domain object.
    filter.catch(new InvalidCredentialsFailure(), host);

    const [[body]] = jsonMock.mock.calls as [[{ message: string }]];
    expect(body.message).toBe('Invalid email or password.');
  });
});
