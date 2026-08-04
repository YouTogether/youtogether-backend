import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { CreateVideoSessionDto } from '../../../../src/video-sync/presentation/dtos/create-video-session.dto';

/**
 * Unit tests for CreateVideoSessionDto validation.
 *
 * Mirrors `create-room.dto.spec.ts`: uses class-validator directly,
 * without bootstrapping the full NestJS application.
 *
 * @competency Unit test harness for DTO validation rules.
 * @competency Test scenario malformed id rejected.
 */
describe('CreateVideoSessionDto (validation)', () => {
  async function validateDto(
    plain: Record<string, unknown>,
  ): Promise<string[]> {
    const dto = plainToInstance(CreateVideoSessionDto, plain);
    const errors = await validate(dto);
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('should produce no validation errors for a valid 11-character id', async () => {
    const errors = await validateDto({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(errors).toHaveLength(0);
  });

  it('should accept ids containing hyphens and underscores', async () => {
    const errors = await validateDto({ youtubeVideoId: 'a-B_1-2_3aB' });

    expect(errors).toHaveLength(0);
  });

  it('should fail when youtubeVideoId is missing', async () => {
    const errors = await validateDto({});

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when youtubeVideoId is shorter than 11 characters', async () => {
    const errors = await validateDto({ youtubeVideoId: 'short' });

    expect(errors.some((e) => e.toLowerCase().includes('youtubevideoid'))).toBe(
      true,
    );
  });

  it('should fail when youtubeVideoId is longer than 11 characters', async () => {
    const errors = await validateDto({ youtubeVideoId: 'toolong1234567' });

    expect(errors.some((e) => e.toLowerCase().includes('youtubevideoid'))).toBe(
      true,
    );
  });

  it('should fail when youtubeVideoId contains an invalid character (e.g. a space)', async () => {
    const errors = await validateDto({ youtubeVideoId: 'dQw4w9WgX Q' });

    expect(errors.some((e) => e.toLowerCase().includes('youtubevideoid'))).toBe(
      true,
    );
  });

  it('should fail when youtubeVideoId is not a string', async () => {
    const errors = await validateDto({ youtubeVideoId: 12345678901 });

    expect(errors.some((e) => e.toLowerCase().includes('youtubevideoid'))).toBe(
      true,
    );
  });
});
