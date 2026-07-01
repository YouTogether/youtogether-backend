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
import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { GetCurrentUserUseCase } from '../../../../src/auth/domain/usecases/get-current-user.usecase';
import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import { JwtAuthGuard } from '../../../../src/auth/presentation/guards/jwt-auth.guard';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Integration tests for POST /auth/logout (B-A04-T1).
 *
 * Unlike register/login/refresh, this is the first auth endpoint protected
 * by {@link JwtAuthGuard}. The guard is exercised against a fully
 * bootstrapped application — these tests are the authoritative proof that
 * "missing or invalid token returns 401"
 * holds for a concrete protected route, not just in isolation.
 *
 * Scenarios covered:
 * - 200 OK:  valid access token, session terminated.
 * - Consequence: the refresh token issued at registration becomes invalid
 *   (POST /auth/refresh subsequently returns 401), proving the DB write.
 * - Idempotency: a second logout call with the same valid access token
 *   still returns 200.
 * - 401: no Authorization header at all.
 * - 401: malformed Authorization header (not a Bearer token).
 * - 401: a syntactically well-formed but invalid/garbage access token.
 * - 401: an access token signed with the wrong secret.
 * - 401: an expired access token.
 *
 * @competency Integration test harness.
 * @competency Acceptance criteria for B-A04-T1: guard enforced, hash
 *   cleared, subsequent refresh fails.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface AuthSuccessBody {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}

describe('POST /auth/logout (integration)', () => {
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
            // No dropSchema: this file runs alongside register/login/refresh
            // integration specs against the same physical test database.
            // Dropping the schema here would destroy tables mid-query in a
            // concurrently running file (this was the root cause of a
            // "relation users does not exist" failure observed in
            // login.integration.spec.ts). The migration is idempotent
            // (CREATE TABLE IF NOT EXISTS), so migrationsRun alone is
            // sufficient and safe under arbitrary Jest worker parallelism.
            // Cleanup is scoped to this file's own rows via the
            // '@logout-test.com' email suffix (see afterEach).
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
       WHERE email LIKE '%@logout-test.com'`,
    );
  });

  const registerSeedUser = async (email: string): Promise<AuthSuccessBody> => {
    const response = await request(httpServer)
      .post('/auth/register')
      .send({ email, password: 'securepassword', username: 'logoutuser' });
    return response.body as AuthSuccessBody;
  };

  // ─── 200 OK ───────────────────────────────────────────────────────

  describe('200 OK', () => {
    it('should return 200 with a valid access token', async () => {
      const { accessToken } = await registerSeedUser('basic@logout-test.com');

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should invalidate the refresh token issued at registration', async () => {
      const { accessToken, refreshToken } = await registerSeedUser(
        'invalidate@logout-test.com',
      );

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should be idempotent: a second logout with the same access token still returns 200', async () => {
      const { accessToken } = await registerSeedUser('twice@logout-test.com');

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should not require or accept a request body', async () => {
      const { accessToken } = await registerSeedUser('nobody@logout-test.com');

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);
    });
  });

  // ─── 401 — guard enforcement ───────────────────────────────────────

  describe('401 Unauthorized — JwtAuthGuard enforcement', () => {
    it('should return 401 when no Authorization header is present', async () => {
      await request(httpServer).post('/auth/logout').expect(401);
    });

    it('should return 401 when the Authorization header is not a Bearer token', async () => {
      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);
    });

    it('should return 401 for a syntactically invalid token', async () => {
      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('should return 401 for a token signed with the wrong secret', async () => {
      const forgedToken = sign(
        {
          sub: '550e8400-e29b-41d4-a716-446655440000',
          role: 'registered',
        },
        'a-completely-different-secret',
        { expiresIn: '15m' },
      );

      await request(httpServer)
        .post('/auth/logout')
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
        .post('/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should not clear any session when the guard rejects the request', async () => {
      const { accessToken, refreshToken } = await registerSeedUser(
        'guardreject@logout-test.com',
      );

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', 'Bearer garbage-token')
        .expect(401);

      // The legitimate session must remain intact: refresh still works,
      // and a properly authenticated logout still succeeds afterward.
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
