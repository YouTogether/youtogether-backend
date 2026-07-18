import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { AuthController } from '../../src/auth/presentation/controllers/auth.controller';
import { RegisterUseCase } from '../../src/auth/domain/usecases/register.usecase';
import { LoginUseCase } from '../../src/auth/domain/usecases/login.usecase';
import { RefreshUseCase } from '../../src/auth/domain/usecases/refresh.usecase';
import { LogoutUseCase } from '../../src/auth/domain/usecases/logout.usecase';
import { GetCurrentUserUseCase } from '../../src/auth/domain/usecases/get-current-user.usecase';
import { RoomController } from '../../src/room/presentation/controllers/room.controller';
import { CreateRoomUseCase } from '../../src/room/domain/usecases/create-room.usecase';
import { GetPublicRoomsUseCase } from '../../src/room/domain/usecases/get-public-rooms.usecase';
import { GetRoomByIdUseCase } from '../../src/room/domain/usecases/get-room-by-id.usecase';
import { UpdateRoomUseCase } from '../../src/room/domain/usecases/update-room.usecase';
import { DeleteRoomUseCase } from '../../src/room/domain/usecases/delete-room.usecase';
import { JoinRoomUseCase } from '../../src/room/domain/usecases/join-room.usecase';
import { LeaveRoomUseCase } from '../../src/room/domain/usecases/leave-room.usecase';
import { IRoomRepository } from '../../src/room/domain/repositories/room-repository.interface';

/**
 * Verifies that the OpenAPI/Swagger document generated for the API
 * exposes the expected tags, paths, and bearer-auth security scheme.
 *
 * Deliberately DB-independent: controllers are wired against stub
 * providers (mirroring `auth.controller.spec.ts` / `room.controller.spec.ts`),
 * since `SwaggerModule.createDocument` only introspects route and
 * decorator metadata — it never invokes a handler or touches a
 * repository.
 *
 * @competency Documented, evolvable API surface.
 */
describe('OpenAPI document generation', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const roomRepositoryStub: IRoomRepository = {
      create: jest.fn(),
      findOwnerId: jest.fn(),
      getPublicRooms: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, RoomController],
      providers: [
        { provide: RegisterUseCase, useValue: { execute: jest.fn() } },
        { provide: LoginUseCase, useValue: { execute: jest.fn() } },
        { provide: RefreshUseCase, useValue: { execute: jest.fn() } },
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: GetCurrentUserUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateRoomUseCase, useValue: { execute: jest.fn() } },
        { provide: GetPublicRoomsUseCase, useValue: { execute: jest.fn() } },
        { provide: GetRoomByIdUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateRoomUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteRoomUseCase, useValue: { execute: jest.fn() } },
        { provide: JoinRoomUseCase, useValue: { execute: jest.fn() } },
        { provide: LeaveRoomUseCase, useValue: { execute: jest.fn() } },
        { provide: IRoomRepository, useValue: roomRepositoryStub },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('YouTogether API')
      .setDescription('REST API for the YouTogether watch-party application')
      .setVersion('1.0')
      .addTag(
        'Authentication',
        'Registration, login, session refresh, logout, and profile retrieval.',
      )
      .addTag(
        'Rooms',
        'Creating, browsing, updating, deleting, joining, and leaving watch-party rooms.',
      )
      .addBearerAuth()
      .build();

    document = SwaggerModule.createDocument(app, config);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should expose the Authentication and Rooms tags', () => {
    const tagNames = (document.tags ?? []).map((tag) => tag.name);

    expect(tagNames).toContain('Authentication');
    expect(tagNames).toContain('Rooms');
  });

  it('should tag each operation with its bounded context (path-level, independent of document.tags)', () => {
    expect(document.paths['/api/v1/auth/register']?.post?.tags).toContain(
      'Authentication',
    );
    expect(document.paths['/api/v1/rooms']?.post?.tags).toContain('Rooms');
  });

  it('should document every Authentication route under /api/v1', () => {
    expect(document.paths['/api/v1/auth/register']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/login']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/refresh']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/logout']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/me']?.get).toBeDefined();
  });

  it('should document every Room route under /api/v1', () => {
    expect(document.paths['/api/v1/rooms']?.post).toBeDefined();
    expect(document.paths['/api/v1/rooms']?.get).toBeDefined();
    expect(document.paths['/api/v1/rooms/{id}']?.get).toBeDefined();
    expect(document.paths['/api/v1/rooms/{id}']?.patch).toBeDefined();
    expect(document.paths['/api/v1/rooms/{id}']?.delete).toBeDefined();
    expect(document.paths['/api/v1/rooms/{id}/join']?.post).toBeDefined();
    expect(document.paths['/api/v1/rooms/{id}/leave']?.post).toBeDefined();
  });

  it('should not document any unversioned (unprefixed) path', () => {
    expect(document.paths['/auth/register']).toBeUndefined();
    expect(document.paths['/rooms']).toBeUndefined();
  });

  it('should register a bearer-auth security scheme', () => {
    expect(
      document.components?.securitySchemes?.bearer ??
        document.components?.securitySchemes?.['bearer'],
    ).toBeDefined();
  });

  it('should mark protected routes as requiring bearer auth', () => {
    const createRoom = document.paths['/api/v1/rooms']?.post;
    const listRooms = document.paths['/api/v1/rooms']?.get;

    expect(createRoom?.security).toBeDefined();
    expect(createRoom?.security?.length).toBeGreaterThan(0);
    // GET /rooms is intentionally public — no bearer auth requirement.
    expect(listRooms?.security ?? []).toHaveLength(0);
  });
});
