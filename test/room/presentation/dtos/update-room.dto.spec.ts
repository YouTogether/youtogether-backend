import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { UpdateRoomDto } from '../../../../src/room/presentation/dtos/update-room.dto';

/**
 * Unit tests for UpdateRoomDto validation.
 *
 * Mirrors `create-room.dto.spec.ts`, with every field optional to support
 * partial updates.
 *
 * @competency Unit test harness for DTO validation rules.
 * @competency Test scenarios R-UPD-02, R-UPD-04.
 */
describe('UpdateRoomDto (validation)', () => {
  async function validateDto(
    plain: Record<string, unknown>,
  ): Promise<string[]> {
    const dto = plainToInstance(UpdateRoomDto, plain);
    const errors = await validate(dto);
    return errors.flatMap((e) => Object.values(e.constraints ?? {}));
  }

  it('should produce no validation errors for a valid partial payload (name only)', async () => {
    const errors = await validateDto({ name: 'Renamed Room' });

    expect(errors).toHaveLength(0);
  });

  it('should produce no validation errors for a valid partial payload (description only)', async () => {
    const errors = await validateDto({ description: 'New description' });

    expect(errors).toHaveLength(0);
  });

  it('should produce no validation errors for an empty payload (no-op update)', async () => {
    const errors = await validateDto({});

    expect(errors).toHaveLength(0);
  });

  it('should fail when name is an empty string (R-UPD-04)', async () => {
    const errors = await validateDto({ name: '' });

    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('should fail when name exceeds 100 characters (R-UPD-04)', async () => {
    const errors = await validateDto({ name: 'a'.repeat(101) });

    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('should fail when description is not a string', async () => {
    const errors = await validateDto({ description: 12345 });

    expect(errors.some((e) => e.toLowerCase().includes('description'))).toBe(
      true,
    );
  });
});
