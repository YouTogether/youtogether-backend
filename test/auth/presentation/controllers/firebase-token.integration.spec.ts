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
import { IFirebaseAuthProvider } from '../../../../src/auth/domain/repositories/firebase-auth-provider.interface';
import { FirebaseTokenUnavailableFailure } from '../../../../src/auth/domain/failures/firebase-token.failure';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { LoginUseCase } from '../../../../src/auth/domain/usecases/login.usecase';
import { RefreshUseCase } from '../../../../src/auth/domain/usecases/refresh.usecase';
import { LogoutUseCase } from '../../../../src/auth/domain/usecases/logout.usecase';
import { GetCurrentUserUseCase } from '../../../../src/auth/domain/usecases/get-current-user.usecase';
import { IssueFirebaseTokenUseCase } from '../../../../src/auth/domain/usecases/issue-firebase-token.usecase';
import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import { JwtAuthGuard } from '../../../../src/auth/presentation/guards/jwt-auth.guard';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Integration tests for POST /auth/firebase-token.
 *
 * The third endpoint to mount {@link JwtAuthGuard}, after
 * POST /auth/logout and GET /auth/me, and the only one that hands the
 * caller a credential for a *different* system.
 *
 * {@link IFirebaseAuthProvider} is stubbed at the port, never the real
 * {@link FirebaseAuthProviderService}. Exercising the Admin SDK here
 * would require a service-account private key in CI and a network call
 * to Google's signing endpoint on every run — the same reasoning that
 * keeps `YouTubeService` and `IRealtimeStateWriter` stubbed in their own
 * integration suites. What is under test is the route, the guard, the
 * freshness check and the failure mapping; the SDK call itself is
 * covered by `firebase-auth-provider.service.spec.ts`.
 *
 * Scenarios covered:
 * - 201: valid access token, token issued, body carries nothing else.
 * - 201: the uid handed to the provider is the caller's own id, never a
 *   value the client could influence.
 * - 401: the token's user was soft-deleted after the token was issued —
 *   and, critically, no token is minted in that case. A Firebase session
 *   refreshes itself indefinitely, so one issued for a deactivated
 *   account would outlive the account.
 * - 401: no Authorization header, malformed header, wrong signing
 *   secret, expired token.
 * - 502: the provider fails; the caller's own session is unaffected.
 *
 * @competency Integration test harness.
 * @competency Test scenarios A-FBT-01, A-FBT-02, A-FBT-03, A-FBT-04.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-access-secret-do-not-use-in-production';

describe('POST /auth/firebase-token (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

  const createCustomTokenMock = jest.fn();

  const CREDENTIALS = {
    email: 'firebase-token@example.com',
    password: 'P4ssw0rd!value',
    username: 'firebasetokenuser',
  };

  /**
   * Registers a fresh account through the public API and returns its
   * access token and id.
   *
   * Registering rather than seeding rows directly keeps this suite
   * honest about the token it presents: it is one the application
   * actually issued, not one hand-signed to match assumptions about the
   * claim shape.
   */
  const registerUser = async (): Promise<{
    accessToken: string;
    userId: string;
  }> => {
    const response = await request(httpServer)
      .post('/auth/register')
      .send(CREDENTIALS)
      .expect(201);

    const body = response.body as {
      accessToken: string;
      user: { id: string };
    };

    return { accessToken: body.accessToken, userId: body.user.id };
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // NOTE: copy this TypeOrmModule.forRootAsync block verbatim from
        // me.integration.spec.ts so both suites share one database
        // configuration. Duplicating it by hand is how the two drift.
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const databaseUrl = process.env.DATABASE_URL;
            const connection =
              databaseUrl !== undefined && databaseUrl !== ''
                ? { url: databaseUrl }
                : {
                    host: configService.get<string>('DB_HOST', 'localhost'),
                    port: configService.get<number>('DB_PORT', 5432),
                    username: configService.get<string>(
                      'DB_USERNAME',
                      'postgres',
                    ),
                    password: configService.get<string>(
                      'DB_PASSWORD',
                      'postgres',
                    ),
                    database: configService.get<string>(
                      'DB_TEST_DATABASE',
                      'youtogether_test',
                    ),
                  };

            return {
              type: 'postgres' as const,
              ...connection,
              entities: [UserOrmEntity],
              migrations: [CreateUsersTable1714000000000],
              // No dropSchema: this file may run concurrently with the
              // other *.integration.spec.ts files against the same
              // physical test database. The migration is idempotent
              // (CREATE TABLE IF NOT EXISTS), so migrationsRun alone is
              // sufficient under arbitrary parallelism.
              migrationsRun: true,
              synchronize: false,
              logging: ['error' as const],
            };
          },
        }),
        TypeOrmModule.forFeature([UserOrmEntity]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          useFactory: () => ({
            secret:
              process.env.JWT_SECRET ??
              'test-access-secret-do-not-use-in-production',
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
        IssueFirebaseTokenUseCase,
        TokenService,
        JwtStrategy,
        JwtAuthGuard,
        { provide: IAuthRepository, useClass: AuthRepositoryImpl },
        {
          provide: IFirebaseAuthProvider,
          useValue: { createCustomToken: createCustomTokenMock },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    httpServer = app.getHttpServer() as Server;
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    createCustomTokenMock.mockReset();
    createCustomTokenMock.mockResolvedValue('mock.custom.token');

    await dataSource.query('DELETE FROM users WHERE email = $1', [
      CREDENTIALS.email,
    ]);
  });

  describe('success', () => {
    it('should return 201 with a Firebase token (A-FBT-01)', async () => {
      const { accessToken } = await registerUser();

      const response = await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect((response.body as { firebaseToken: string }).firebaseToken).toBe(
        'mock.custom.token',
      );
    });

    it('should return the token and nothing else', async () => {
      const { accessToken } = await registerUser();

      const response = await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(Object.keys(response.body as object)).toEqual(['firebaseToken']);
    });

    it("should mint the token for the caller's own id (A-FBT-03)", async () => {
      const { accessToken, userId } = await registerUser();

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(createCustomTokenMock).toHaveBeenCalledWith(userId);
      expect(createCustomTokenMock).toHaveBeenCalledTimes(1);
    });

    it('should ignore any body the client sends (A-FBT-03)', async () => {
      // The route takes no body. ValidationPipe's whitelist strips
      // unknown fields, and the userId comes from @CurrentUser
      // regardless — but a client attempting to name a different uid is
      // exactly the attack this endpoint must not enable, so it is
      // asserted rather than assumed.
      const { accessToken, userId } = await registerUser();

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId: '00000000-0000-4000-8000-000000000000' })
        .expect(201);

      expect(createCustomTokenMock).toHaveBeenCalledWith(userId);
    });
  });

  describe('account no longer active', () => {
    it('should return 401 when the account was soft-deleted after the token was issued (A-FBT-02)', async () => {
      const { accessToken } = await registerUser();

      await dataSource.query(
        'UPDATE users SET deleted_at = NOW() WHERE email = $1',
        [CREDENTIALS.email],
      );

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('should mint no token for a deactivated account (A-FBT-02)', async () => {
      // The load-bearing assertion of this suite. A Firebase session
      // established from a custom token refreshes itself indefinitely
      // and cannot be revoked from here, so a token minted here would
      // grant Realtime Database write access outliving the account.
      const { accessToken } = await registerUser();

      await dataSource.query(
        'UPDATE users SET deleted_at = NOW() WHERE email = $1',
        [CREDENTIALS.email],
      );

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(createCustomTokenMock).not.toHaveBeenCalled();
    });
  });

  describe('guard enforcement', () => {
    it('should return 401 with no Authorization header', async () => {
      await request(httpServer).post('/auth/firebase-token').expect(401);
    });

    it('should return 401 with a malformed Authorization header', async () => {
      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', 'NotBearer something')
        .expect(401);
    });

    it('should return 401 with a garbage access token', async () => {
      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });

    it('should return 401 for a token signed with the wrong secret', async () => {
      const { userId } = await registerUser();
      const forged = sign({ sub: userId }, 'a-different-secret', {
        expiresIn: '15m',
      });

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('should return 401 for an expired access token', async () => {
      const { userId } = await registerUser();
      const expired = sign({ sub: userId }, TEST_JWT_SECRET, {
        expiresIn: '-1s',
      });

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('should mint no token for any rejected request', async () => {
      await request(httpServer).post('/auth/firebase-token').expect(401);

      expect(createCustomTokenMock).not.toHaveBeenCalled();
    });
  });

  describe('provider failure', () => {
    it('should return 502 when the token cannot be signed (A-FBT-04)', async () => {
      const { accessToken } = await registerUser();
      createCustomTokenMock.mockRejectedValue(
        new FirebaseTokenUnavailableFailure('credentials rejected'),
      );

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(502);
    });

    it('should leave the caller session usable after a 502 (A-FBT-04)', async () => {
      // A Firebase outage must not look like a session problem: the
      // client should retry the token call, not force a re-login.
      const { accessToken } = await registerUser();
      createCustomTokenMock.mockRejectedValue(
        new FirebaseTokenUnavailableFailure('credentials rejected'),
      );

      await request(httpServer)
        .post('/auth/firebase-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(502);

      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
