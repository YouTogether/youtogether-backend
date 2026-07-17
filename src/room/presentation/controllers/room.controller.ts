import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateRoomUseCase } from '../../domain/usecases/create-room.usecase';
import { CreateRoomParams } from '../../domain/usecases/create-room.params';
import { GetPublicRoomsUseCase } from '../../domain/usecases/get-public-rooms.usecase';
import { GetRoomByIdUseCase } from '../../domain/usecases/get-room-by-id.usecase';
import { GetRoomByIdParams } from '../../domain/usecases/get-room-by-id.params';
import { UpdateRoomUseCase } from '../../domain/usecases/update-room.usecase';
import { UpdateRoomParams } from '../../domain/usecases/update-room.params';
import { DeleteRoomUseCase } from '../../domain/usecases/delete-room.usecase';
import { DeleteRoomParams } from '../../domain/usecases/delete-room.params';
import { JoinRoomUseCase } from '../../domain/usecases/join-room.usecase';
import { JoinRoomParams } from '../../domain/usecases/join-room.params';
import { LeaveRoomUseCase } from '../../domain/usecases/leave-room.usecase';
import { LeaveRoomParams } from '../../domain/usecases/leave-room.params';
import { CreateRoomDto } from '../dtos/create-room.dto';
import { UpdateRoomDto } from '../dtos/update-room.dto';
import { RoomResponseDto } from '../dtos/room-response.dto';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../auth/presentation/interfaces/authenticated-user.interface';
import { RoomExceptionFilter } from '../filters/room-exception.filter';
import { OwnershipGuard } from '../guards/ownership.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

/**
 * Controller for the Room bounded context.
 *
 * Maps HTTP routes to domain use cases. Contains no business logic: it
 * transforms HTTP input (DTOs) into domain value objects, delegates to
 * use cases, and shapes HTTP responses — mirroring `AuthController`.
 *
 * Reuses {@link JwtAuthGuard} and {@link CurrentUser} exported by the
 * Authentication bounded context rather than redefining
 * authentication logic for this module.
 *
 * Routes:
 * - POST   /rooms           -> {@link CreateRoomUseCase} (protected by {@link JwtAuthGuard})
 * - GET    /rooms           -> {@link GetPublicRoomsUseCase} (no authentication required)
 * - GET    /rooms/:id       -> {@link GetRoomByIdUseCase} (no authentication required)
 * - PATCH  /rooms/:id       -> {@link UpdateRoomUseCase} (protected by {@link JwtAuthGuard}, {@link OwnershipGuard})
 * - DELETE /rooms/:id       -> {@link DeleteRoomUseCase} (protected by {@link JwtAuthGuard}, {@link OwnershipGuard})
 * - POST   /rooms/:id/join  -> {@link JoinRoomUseCase} (protected by {@link JwtAuthGuard})
 * - POST   /rooms/:id/leave -> {@link LeaveRoomUseCase} (protected by {@link JwtAuthGuard})
 *
 * @see CreateRoomUseCase
 * @see GetPublicRoomsUseCase
 * @see GetRoomByIdUseCase
 * @see UpdateRoomUseCase
 * @see DeleteRoomUseCase
 * @see JoinRoomUseCase
 * @see LeaveRoomUseCase
 * @see RoomExceptionFilter
 */
@ApiTags('Rooms')
@Controller('rooms')
@UseFilters(RoomExceptionFilter)
export class RoomController {
  constructor(
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly getPublicRoomsUseCase: GetPublicRoomsUseCase,
    private readonly getRoomByIdUseCase: GetRoomByIdUseCase,
    private readonly updateRoomUseCase: UpdateRoomUseCase,
    private readonly deleteRoomUseCase: DeleteRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    private readonly leaveRoomUseCase: LeaveRoomUseCase,
  ) {}

  /**
   * POST /rooms
   *
   * Creates a new room with the authenticated user as owner, and
   * auto-joins that owner as the first active member.
   *
   * The owner id is taken exclusively from the validated
   * {@link AuthenticatedUser} (via {@link CurrentUser}) — never from the
   * request body — so a user can only ever create rooms under their own
   * identity (OWASP A01:2021 — Broken Access Control).
   *
   * HTTP status codes:
   * - 201 Created       — room created successfully.
   * - 400 Bad Request   — validation failure (missing/oversized name, etc.).
   * - 401 Unauthorized  — missing, invalid, or expired access token.
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a room (creator becomes owner and first member)',
  })
  @ApiCreatedResponse({ type: RoomResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    const room = await this.createRoomUseCase.execute(
      new CreateRoomParams({
        ownerId: user.userId,
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic ?? true,
      }),
    );

    return RoomResponseDto.fromRoomEntity(room);
  }

  /**
   * GET /rooms
   *
   * Returns every active, public room, each annotated with its current
   * active member count. No authentication required — guest access is
   * permitted for public room discovery.
   *
   * HTTP status codes:
   * - 200 OK — list returned (possibly empty).
   */
  @ApiOperation({ summary: 'List public rooms' })
  @ApiOkResponse({ type: [RoomResponseDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<RoomResponseDto[]> {
    const rooms = await this.getPublicRoomsUseCase.execute();

    return rooms.map((room) => RoomResponseDto.fromRoomEntity(room));
  }

  /**
   * GET /rooms/:id
   *
   * Returns a single room's details, annotated with its current active
   * member count. No authentication required — a room's page (or a
   * guest preview before joining) does not require a session.
   *
   * Does not yet include the room's current video session: the
   * `video_sessions` table is introduced in Video Synchronisation
   * bounded context. This response shape will be extended at that point
   * rather than stubbed out prematurely here.
   *
   * HTTP status codes:
   * - 200 OK          — room found.
   * - 404 Not Found   — the room does not exist or is soft-deleted
   *   ({@link RoomNotFoundFailure}, mapped by {@link RoomExceptionFilter}).
   */
  @ApiOperation({ summary: 'Retrieve a room by id' })
  @ApiOkResponse({ type: RoomResponseDto })
  @ApiNotFoundResponse({ description: 'Room does not exist or was deleted' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<RoomResponseDto> {
    const room = await this.getRoomByIdUseCase.execute(
      new GetRoomByIdParams({ roomId: id }),
    );

    return RoomResponseDto.fromRoomEntity(room);
  }

  /**
   * PATCH /rooms/:id
   *
   * Updates a room's name and/or description. Only the room owner may
   * perform this action — enforced by {@link OwnershipGuard}, which runs
   * after {@link JwtAuthGuard} in the guard chain and reads the same
   * `:id` route parameter this handler uses.
   *
   * HTTP status codes:
   * - 200 OK            — room updated successfully.
   * - 400 Bad Request   — validation failure (oversized name, etc.).
   * - 401 Unauthorized  — missing, invalid, or expired access token.
   * - 403 Forbidden     — the authenticated user is not the room owner
   *   (thrown directly by {@link OwnershipGuard}, not via
   *   {@link RoomExceptionFilter} — see that guard's own documentation).
   * - 404 Not Found     — the room does not exist or is soft-deleted.
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update room name and/or description (owner only)' })
  @ApiOkResponse({ type: RoomResponseDto })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not the room owner',
  })
  @ApiNotFoundResponse({ description: 'Room does not exist or was deleted' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    const room = await this.updateRoomUseCase.execute(
      new UpdateRoomParams({
        roomId: id,
        name: dto.name,
        description: dto.description,
      }),
    );

    return RoomResponseDto.fromRoomEntity(room);
  }

  /**
   * DELETE /rooms/:id
   *
   * Soft-deletes a room. Only the room owner may perform this action —
   * enforced by {@link OwnershipGuard}, the same guard reused from
   * `PATCH /rooms/:id`.
   *
   * `room_memberships` rows are preserved for audit purposes (soft
   * delete, not a hard delete) — see `RoomRepositoryImpl.delete`.
   *
   * HTTP status codes:
   * - 200 OK            — room deleted successfully.
   * - 401 Unauthorized  — missing, invalid, or expired access token.
   * - 403 Forbidden     — the authenticated user is not the room owner
   *   (thrown directly by {@link OwnershipGuard}).
   * - 404 Not Found     — the room does not exist or was already deleted
   *   (in practice, always caught by {@link OwnershipGuard} itself,
   *   whose `findOwnerId` lookup excludes soft-deleted rows).
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a room (owner only)' })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not the room owner',
  })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteRoomUseCase.execute(new DeleteRoomParams({ roomId: id }));
  }

  /**
   * POST /rooms/:id/join
   *
   * Creates an active membership for the authenticated user in the given
   * room. Any authenticated user may join any existing, non-deleted room
   * — no ownership check here, unlike `PATCH`/`DELETE`.
   *
   * HTTP status codes:
   * - 200 OK            — membership created; response includes the
   *   refreshed active member count.
   * - 401 Unauthorized  — missing, invalid, or expired access token.
   * - 404 Not Found     — the room does not exist or is soft-deleted.
   * - 409 Conflict      — the user already holds an active membership in
   *   this room ({@link RoomAlreadyJoinedFailure}). Rejoining after
   *   having left is allowed — see that failure's own documentation.
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Join a room as a member' })
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async join(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomResponseDto> {
    const room = await this.joinRoomUseCase.execute(
      new JoinRoomParams({ roomId: id, userId: user.userId }),
    );

    return RoomResponseDto.fromRoomEntity(room);
  }

  /**
   * POST /rooms/:id/leave
   *
   * Ends the authenticated user's active membership in the given room.
   * No `OwnershipGuard` here — unlike `PATCH`/`DELETE`, this route is
   * for non-owner members; the owner-cannot-leave rule is enforced as a
   * business invariant inside the use case, not as a route-level guard.
   *
   * HTTP status codes:
   * - 200 OK            — membership ended successfully.
   * - 401 Unauthorized  — missing, invalid, or expired access token.
   * - 403 Forbidden     — the authenticated user is the room's owner
   *   ({@link RoomOwnerCannotLeaveFailure}); delete the room instead.
   * - 404 Not Found     — the room does not exist, or the user holds no
   *   active membership in it ({@link RoomMembershipNotFoundFailure}).
   */
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Leave a room' })
  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leave(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.leaveRoomUseCase.execute(
      new LeaveRoomParams({ roomId: id, userId: user.userId }),
    );
  }
}
