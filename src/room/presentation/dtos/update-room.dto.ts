import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for the PATCH /rooms/:id endpoint.
 *
 * Every field is optional, supporting partial updates: an omitted field
 * means "leave unchanged" (see `UpdateRoomParams`). Only `name` and
 * `description` are in scope, per this task's Definition of
 * Done — `isPublic` is deliberately not included here: accepting a field
 * the use case would silently ignore would be misleading to API
 * consumers. Visibility toggling can be added as its own field (and its
 * own test scenarios) if a future task requires it.
 *
 * As with {@link CreateRoomDto}, the global `ValidationPipe`
 * (`whitelist: true`) strips any unexpected field — including a
 * client-supplied `ownerId` — before this DTO is even constructed.
 *
 * @see RoomController.update
 * @competency Input validation as part of the ergonomic/secure prototype
 */
export class UpdateRoomDto {
  /**
   * New display name for the room, if changing it.
   */
  @ApiPropertyOptional({
    example: 'Renamed Movie Night',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name?: string;

  /**
   * New description for the room, if changing it.
   */
  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;
}
