import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for the POST /rooms/:id/video-session endpoint.
 *
 * Validation rule: `youtubeVideoId` must be exactly 11 characters, using
 * only letters, digits, `-`, and `_` — the format YouTube itself uses
 * for video ids.
 *
 * The global `ValidationPipe` (`whitelist: true`) strips any unexpected
 * field — including a client-supplied `addedBy` — before this DTO is
 * even constructed; the room id itself is taken from the route
 * parameter, not the body.
 *
 * @see VideoSessionController.create
 * @competency Input validation as part of the ergonomic/secure prototype
 */
export class CreateVideoSessionDto {
  /**
   * YouTube video identifier, exactly 11 characters
   * (`^[A-Za-z0-9_-]{11}$`).
   */
  @ApiProperty({ example: 'dQw4w9WgXcQ', minLength: 11, maxLength: 11 })
  @IsString({ message: 'youtubeVideoId must be a string' })
  @Matches(/^[A-Za-z0-9_-]{11}$/, {
    message:
      'youtubeVideoId must be exactly 11 characters (letters, digits, - or _)',
  })
  youtubeVideoId!: string;
}
