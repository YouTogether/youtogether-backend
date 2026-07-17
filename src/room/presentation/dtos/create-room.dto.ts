import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Data Transfer Object for the POST /rooms endpoint.
 *
 * Validation rules:
 * - `name`: non-empty, max 100 characters.
 * - `description`: optional.
 * - `isPublic`: optional boolean, defaults to `true` when omitted
 *   (the default is applied in {@link RoomController.create}, not here,
 *   so that "omitted" and "explicitly false" remain distinguishable at
 *   the validation layer).
 *
 * The global `ValidationPipe` (configured with `whitelist: true`) strips
 * any unexpected field — including a client-supplied `ownerId` — before
 * this DTO is even constructed, which is why no such field exists here:
 * the owner is exclusively derived from the authenticated request.
 *
 * @see RoomController.create
 * @competency Input validation as part of the ergonomic/secure prototype
 */
export class CreateRoomDto {
  /**
   * Public display name of the room.
   * Must be a non-empty string of at most 100 characters.
   */
  @ApiProperty({ example: 'Friday Movie Night', maxLength: 100 })
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name!: string;

  /**
   * Optional short description of the room.
   */
  @ApiPropertyOptional({ example: 'Weekly watch party' })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;

  /**
   * Whether the room appears in the public listing.
   * Defaults to `true` when omitted.
   */
  @ApiPropertyOptional({
    description: 'Defaults to true when omitted',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isPublic must be a boolean' })
  isPublic?: boolean;
}
