import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { CreateRoomUseCase } from '../../domain/usecases/create-room.usecase';
import { CreateRoomParams } from '../../domain/usecases/create-room.params';
import { GetPublicRoomsUseCase } from '../../domain/usecases/get-public-rooms.usecase';
import { GetRoomByIdUseCase } from '../../domain/usecases/get-room-by-id.usecase';
import { GetRoomByIdParams } from '../../domain/usecases/get-room-by-id.params';
import { CreateRoomDto } from '../dtos/create-room.dto';
import { RoomResponseDto } from '../dtos/room-response.dto';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../auth/presentation/interfaces/authenticated-user.interface';
import { RoomExceptionFilter } from '../filters/room-exception.filter';

/**
 * Controller for the Room bounded context.
 *
 * Maps HTTP routes to domain use cases. Contains no business logic: it
 * transforms HTTP input (DTOs) into domain value objects, delegates to
 * use cases, and shapes HTTP responses — mirroring `AuthController`.
 *
 * Reuses {@link JwtAuthGuard} and {@link CurrentUser} exported by the
 * Authentication bounded context (B-A06) rather than redefining
 * authentication logic for this module.
 *
 * Routes:
 * - POST /rooms -> {@link CreateRoomUseCase} (protected by {@link JwtAuthGuard})
 * - GET  /rooms -> {@link GetPublicRoomsUseCase} (no authentication required)
 *
 * @see CreateRoomUseCase
 * @see GetPublicRoomsUseCase
 * @see GetRoomByIdUseCase
 * @see RoomExceptionFilter
 */
@Controller('rooms')
@UseFilters(RoomExceptionFilter)
export class RoomController {
  constructor(
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly getPublicRoomsUseCase: GetPublicRoomsUseCase,
    private readonly getRoomByIdUseCase: GetRoomByIdUseCase,
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
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<RoomResponseDto> {
    const room = await this.getRoomByIdUseCase.execute(
      new GetRoomByIdParams({ roomId: id }),
    );

    return RoomResponseDto.fromRoomEntity(room);
  }
}
