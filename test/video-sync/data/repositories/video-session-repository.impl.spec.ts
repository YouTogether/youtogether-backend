import { DataSource } from 'typeorm';

import { VideoSessionRepositoryImpl } from '../../../../src/video-sync/data/repositories/video-session-repository.impl';
import { VideoSessionOrmEntity } from '../../../../src/video-sync/data/entities/video-session.orm-entity';

/**
 * Unit tests for VideoSessionRepositoryImpl.create.
 *
 * `DataSource.getRepository` is stubbed the same way as
 * `room-repository.impl.spec.ts`: TypeORM's own query builder is not
 * mocked at a finer grain than `save`, keeping the test focused on this
 * repository's own mapping and delegation logic.
 *
 * @competency Unit test harness.
 */
describe('VideoSessionRepositoryImpl', () => {
  let repository: VideoSessionRepositoryImpl;
  let dataSource: DataSource;
  let saveMock: jest.Mock;
  let createMock: jest.Mock;

  const CREATED_AT = new Date('2026-01-05T00:00:00Z');

  beforeEach(() => {
    createMock = jest
      .fn()
      .mockImplementation((partial: Partial<VideoSessionOrmEntity>) => partial);
    saveMock = jest.fn().mockImplementation((entity: VideoSessionOrmEntity) =>
      Promise.resolve({
        ...entity,
        id: 'video-session-uuid',
        createdAt: CREATED_AT,
      }),
    );

    dataSource = {
      getRepository: jest
        .fn()
        .mockReturnValue({ create: createMock, save: saveMock }),
    } as unknown as DataSource;

    repository = new VideoSessionRepositoryImpl(dataSource);
  });

  it('should persist the video session with the provided params and metadata', async () => {
    await repository.create(
      {
        roomId: 'room-uuid',
        youtubeVideoId: 'dQw4w9WgXcQ',
        addedBy: 'user-uuid',
      },
      {
        title: 'Never Gonna Give You Up',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        durationSeconds: 213,
      },
    );

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-uuid',
        youtubeVideoId: 'dQw4w9WgXcQ',
        addedBy: 'user-uuid',
        title: 'Never Gonna Give You Up',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        durationSeconds: 213,
      }),
    );
  });

  it('should return a VideoSessionEntity mapped from the saved row', async () => {
    const result = await repository.create(
      {
        roomId: 'room-uuid',
        youtubeVideoId: 'dQw4w9WgXcQ',
        addedBy: 'user-uuid',
      },
      { title: 'Title', thumbnailUrl: null, durationSeconds: 100 },
    );

    expect(result.id).toBe('video-session-uuid');
    expect(result.createdAt).toBe(CREATED_AT);
    expect(result.thumbnailUrl).toBeNull();
  });
});
