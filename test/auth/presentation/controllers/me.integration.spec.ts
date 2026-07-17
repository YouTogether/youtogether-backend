import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { Server } from 'http';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { LoginUseCase } from '../../../../src/auth/domain/usecases/login.usecase';
import { RefreshUseCase } from '../../../../src/auth/domain/usecases/refresh.usecase';
import { LogoutUseCase } from '../../../../src/auth/domain/usecases/logout.usecase';
import { GetCurrentUserUseCase } from '../../../../src/auth/domain/usecases/get-current-user.usecase';
import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import { JwtAuthGuard } from '../../../../src/auth/presentation/guards/jwt-auth.guard';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Integration tests for GET /auth/me.
 *
 * The second endpoint (after POST /auth/logout) to mount JwtAuthGuard, and
 * the first to actually load and return the protected resource behind it.
 *
 * Scenarios covered:
 * - 200 OK:  valid access token, correct profile shape, sensitive fields excluded.
 * - 401:     no Authorization header, malformed header, invalid signature, expired token.
 * - 401:     token references a user soft-deleted after the token was issued
 *   (the scenario unique to this endpoint — the token itself is still
 *   cryptographically valid, but the fresh database lookup rejects it).
 *
 * @competency Integration test harness.
 * @competency Acceptance criteria for: guard enforced, sensitive
 *   fields excluded, 401 on invalid/expired/orphaned token.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface AuthSuccessBody {
  user: { id: string; email: string; username: string };
  accessToken: string;
}

/**
 * Shape of the GET /auth/me response body — a bare UserProfileDto, distinct
 * from AuthSuccessBody (which wraps the profile under `user` alongside
 * tokens). Declared explicitly so `response.body` can be cast to a known
 * shape instead of being accessed as `any` (no-unsafe-member-access).
 */
interface MeSuccessBody {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  passwordHash?: string;
  refreshTokenHash?: string;
  accessToken?: string;
  refreshToken?: string;
}

describe('GET /auth/me (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          ignoreEnvFile: process.env.DATABASE_URL !== undefined,
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (cs: ConfigService) => ({
            type: 'postgres',
            host: cs.get<string>('DB_HOST', 'localhost'),
            port: cs.get<number>('DB_PORT', 5432),
            username: cs.get<string>('DB_USERNAME', 'postgres'),
            password: cs.get<string>('DB_PASSWORD', 'postgres'),
            database: cs.get<string>('DB_TEST_DATABASE', 'youtogether_test'),
            entities: [UserOrmEntity],
            migrations: [CreateUsersTable1714000000000],
            dropSchema: true,
            migrationsRun: true,
            synchronize: false,
            logging: false,
          }),
        }),
        TypeOrmModule.forFeature([UserOrmEntity]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (cs: ConfigService) => ({
            secret: cs.get<string>('JWT_SECRET', TEST_JWT_SECRET),
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        RegisterUseCase,
        LoginUseCase,
        RefreshUseCase,
        LogoutUseCase,
        GetCurrentUserUseCase,
        TokenService,
        JwtStrategy,
        JwtAuthGuard,
        { provide: IAuthRepository, useClass: AuthRepositoryImpl },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    httpServer = app.getHttpServer() as Server;
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE
       FROM "users"
       WHERE email LIKE '%@me-test.com'`,
    );
  });

  const registerSeedUser = async (email: string): Promise<AuthSuccessBody> => {
    const response = await request(httpServer)
      .post('/auth/register')
      .send({ email, password: 'securepassword', username: 'meuser' });
    return response.body as AuthSuccessBody;
  };

  // ─── 200 OK ───────────────────────────────────────────────────────

  describe('200 OK', () => {
    it('should return the profile for a valid access token', async () => {
      const { accessToken } = await registerSeedUser('basic@me-test.com');

      const response = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as MeSuccessBody;

      expect(body.email).toBe('basic@me-test.com');
      expect(body.username).toBe('meuser');
      expect(body.role).toBe('registered');
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(body.createdAt).toBeDefined();
    });

    it('should not include passwordHash, refreshTokenHash, accessToken, or refreshToken', async () => {
      const { accessToken } = await registerSeedUser('noleak@me-test.com');

      const response = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as MeSuccessBody;

      expect(body.passwordHash).toBeUndefined();
      expect(body.refreshTokenHash).toBeUndefined();
      expect(body.accessToken).toBeUndefined();
      expect(body.refreshToken).toBeUndefined();
    });

    it('should return the same profile id across repeated calls with the same token', async () => {
      const { accessToken } = await registerSeedUser('repeat@me-test.com');

      const first = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const second = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const firstBody = first.body as MeSuccessBody;
      const secondBody = second.body as MeSuccessBody;

      expect(firstBody.id).toBe(secondBody.id);
    });
  });

  // ─── 401 — orphaned token (unique to this endpoint) ────────────────

  describe('401 — token valid but account no longer active', () => {
    it('should return 401 when the account was soft-deleted after the token was issued', async () => {
      const { accessToken } = await registerSeedUser('deleted@me-test.com');

      // Simulate the account being deactivated after the access token
      // was already handed to the client — the token itself remains
      // cryptographically valid for its full lifetime.
      await dataSource.query(
        `UPDATE "users"
         SET deleted_at = now()
         WHERE email = 'deleted@me-test.com'`,
      );

      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  // ─── 401 — guard enforcement ───────────────────────────────────────

  describe('401 Unauthorized — JwtAuthGuard enforcement', () => {
    it('should return 401 when no Authorization header is present', async () => {
      await request(httpServer).get('/auth/me').expect(401);
    });

    it('should return 401 when the Authorization header is not a Bearer token', async () => {
      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);
    });

    it('should return 401 for a syntactically invalid token', async () => {
      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('should return 401 for a token signed with the wrong secret', async () => {
      const forgedToken = sign(
        { sub: '550e8400-e29b-41d4-a716-446655440000', role: 'registered' },
        'a-completely-different-secret',
        { expiresIn: '15m' },
      );

      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(401);
    });

    it('should return 401 for an expired access token', async () => {
      const expiredToken = sign(
        {
          sub: '550e8400-e29b-41d4-a716-446655440000',
          role: 'registered',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        TEST_JWT_SECRET,
      );

      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should return 401 for a well-formed token referencing an unknown user id', async () => {
      const tokenForUnknownUser = sign(
        { sub: '00000000-0000-4000-8000-000000000000', role: 'registered' },
        TEST_JWT_SECRET,
        { expiresIn: '15m' },
      );

      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenForUnknownUser}`)
        .expect(401);
    });
  });
});
