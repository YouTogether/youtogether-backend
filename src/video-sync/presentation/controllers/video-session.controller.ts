import {
  Controller,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CreateVideoSessionUseCase } from '../../domain/usecases/create-video-session.usecase';
import { CreateVideoSessionParams } from '../../domain/usecases/create-video-session.params';
import { CreateVideoSessionDto } from '../dtos/create-video-session.dto';
import { VideoSessionResponseDto } from '../dtos/video-session-response.dto';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../auth/presentation/interfaces/authenticated-user.interface';
import { OwnershipGuard } from '../../../room/presentation/guards/ownership.guard';
import { RoomExceptionFilter } from '../../../room/presentation/filters/room-exception.filter';
import { VideoSessionExceptionFilter } from '../filters/video-session-exception.filter';

/**
 * Controller for the Video Synchronisation bounded context's persistent
 * (PostgreSQL) side.
 *
 * Nested under `/rooms/:id/video-session` rather than its own top-level
 * resource: a video session has no independent existence outside its
 * room, mirroring how `join`/`leave` are nested under `/rooms/:id` on
 * `RoomController` rather than exposed as a `memberships` resource.
 *
 * Reuses {@link OwnershipGuard} from the Room bounded context as-is
 * (imported directly — no barrel file, per project convention): only
 * the room's owner may create a video session (B-V01's Acceptance
 * Criteria), the exact same rule `PATCH`/`DELETE /rooms/:id` already
 * enforce, so a second implementation of the same guard would be pure
 * duplication.
 *
 * Routes:
 * - POST /rooms/:id/video-session -> {@link CreateVideoSessionUseCase}
 *   (protected by {@link JwtAuthGuard}, {@link OwnershipGuard})
 *
 * @see CreateVideoSessionUseCase
 * @see VideoSessionExceptionFilter
 * @see RoomExceptionFilter
 */
@ApiTags('Video Sessions')
@Controller('rooms/:id/video-session')
@UseFilters(RoomExceptionFilter, VideoSessionExceptionFilter)
export class VideoSessionController {
  constructor(
    private readonly createVideoSessionUseCase: CreateVideoSessionUseCase,
  ) {}

  /**
   * POST /rooms/:id/video-session
   *
   * Creates a video session for the given room from a YouTube video id,
   * fetching and caching its metadata. Only the room's owner may create
   * a session (enforced by {@link OwnershipGuard}, reused from the Room
   * bounded context).
   *
   * The `addedBy` field is taken exclusively from the validated
   * {@link AuthenticatedUser} (via {@link CurrentUser}) — never from the
   * request body — following the same OWASP A01:2021 access-control
   * discipline as `RoomController.create`.
   *
   * HTTP status codes:
   * - 201 Created       — session created, metadata cached.
   * - 400 Bad Request   — malformed video id, or YouTube reports the
   *   video does not exist ({@link InvalidYoutubeVideoIdFailure},
   *   {@link YoutubeVideoNotFoundFailure}).
   * - 401 Unauthorized  — missing, invalid, or expired access token.
   * - 403 Forbidden     — the authenticated user is not the room owner
   *   (thrown directly by {@link OwnershipGuard}).
   * - 404 Not Found     — the room does not exist or was deleted.
   * - 502 Bad Gateway   — the YouTube Data API v3 call failed (quota,
   *   network) ({@link YoutubeApiUnavailableFailure}).
   */
  @Post()
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Create a video session for this room from a YouTube video id (owner only)',
  })
  @ApiCreatedResponse({
    description: 'Video session created.',
    type: VideoSessionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Malformed video id, or the video does not exist.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token.',
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not the room owner.',
  })
  @ApiNotFoundResponse({
    description: 'The room does not exist or was deleted.',
  })
  @ApiBadGatewayResponse({
    description: 'The YouTube Data API v3 could not be reached.',
  })
  async create(
    @Param('id') roomId: string,
    @Body() dto: CreateVideoSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VideoSessionResponseDto> {
    const session = await this.createVideoSessionUseCase.execute(
      new CreateVideoSessionParams({
        roomId,
        youtubeVideoId: dto.youtubeVideoId,
        addedBy: user.userId,
      }),
    );

    return VideoSessionResponseDto.fromEntity(session);
  }
}
