import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { CreateRoomDto } from '../../../../src/room/presentation/dtos/create-room.dto';

/**
 * Unit tests for CreateRoomDto validation.
 *
 * Mirrors `register.dto.spec.ts`: uses class-validator directly, without
 * bootstrapping the full NestJS application.
 *
 * @competency Unit test harness for DTO validation rules.
 * @competency Test scenarios R-CRE-03, R-CRE-04, R-CRE-05.
 */
describe('CreateRoomDto (validation)', () => {
  async function validateDto(
    plain: Record<string, unknown>,
  ): Promise<string[]> {
    const dto = plainToInstance(CreateRoomDto, plain);
    const errors = await validate(dto);
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('should produce no validation errors for a valid payload', async () => {
    const errors = await validateDto({
      name: 'Friday Movie Night',
      description: 'Weekly watch party',
      isPublic: true,
    });

    expect(errors).toHaveLength(0);
  });

  it('should produce no validation errors when description and isPublic are omitted', async () => {
    const errors = await validateDto({ name: 'Friday Movie Night' });

    expect(errors).toHaveLength(0);
  });

  // R-CRE-03 — empty/missing name rejected

  it('should fail when name is missing', async () => {
    const errors = await validateDto({ description: 'no name here' });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when name is an empty string', async () => {
    const errors = await validateDto({ name: '' });

    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  // R-CRE-04 — name exceeding 100 characters rejected

  it('should fail when name exceeds 100 characters', async () => {
    const errors = await validateDto({ name: 'a'.repeat(101) });

    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('should pass when name is exactly 100 characters', async () => {
    const errors = await validateDto({ name: 'a'.repeat(100) });

    expect(errors).toHaveLength(0);
  });

  it('should fail when isPublic is not a boolean', async () => {
    const errors = await validateDto({
      name: 'Friday Movie Night',
      isPublic: 'not-a-boolean',
    });

    expect(errors.some((e) => e.toLowerCase().includes('ispublic'))).toBe(true);
  });
});
