import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { LoginUseCase } from '../../../../src/auth/domain/usecases/login.usecase';
import { LogoutUseCase } from '../../../../src/auth/domain/usecases/logout.usecase';
import { RefreshUseCase } from '../../../../src/auth/domain/usecases/refresh.usecase';
import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Integration tests for POST /auth/refresh.
 *
 * A user is registered in beforeAll to obtain a valid initial refresh
 * token, which seeds the rotation/replay scenarios.
 *
 * Scenarios covered:
 * - 200 OK:  valid refresh token rotates to a new pair.
 * - Rotation: the old refresh token can no longer be used after rotation.
 * - 401:     replaying the old (rotated) token clears the session,
 *            forcing re-authentication — even the newest token then fails.
 * - 401:     expired refresh token.
 * - 401:     refresh token signed with the wrong secret.
 * - 400:     malformed token (fails JWT structural validation).
 *
 * @competency Integration test harness.
 * @competency Acceptance criteria for B-A03-T1.
 */
describe('POST /auth/refresh (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  const REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long!!';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (cs: ConfigService) => ({
            type: 'postgres',
            host: cs.get('DB_HOST', 'localhost'),
            port: cs.get<number>('DB_PORT', 5432),
            username: cs.get('DB_USERNAME', 'postgres'),
            password: cs.get('DB_PASSWORD', 'postgres'),
            database: cs.get('DB_TEST_DATABASE', 'youtogether_test'),
            entities: [UserOrmEntity],
            migrations: [CreateUsersTable1714000000000],
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
            secret: cs.get(
              'JWT_SECRET',
              'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd',
            ),
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        RegisterUseCase,
        LoginUseCase,
        LogoutUseCase,
        RefreshUseCase,
        TokenService,
        JwtStrategy,
        { provide: IAuthRepository, useClass: AuthRepositoryImpl },
        {
          // Ensure JWT_REFRESH_SECRET resolves even if .env.test omits it,
          // by overriding ConfigService.getOrThrow for this one key while
          // delegating everything else to the real instance.
          provide: ConfigService,
          useFactory: () => {
            const real = new ConfigService();
            const original = real.getOrThrow.bind(real) as (
              key: string,
            ) => string;
            real.getOrThrow = ((key: string) => {
              if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
              if (key === 'JWT_SECRET')
                return 'fad88969cbab1e29152e2ebab6306a61fb2a07f4ec662938f57988d030c7cb3c02db9dac544d65faa5efdf6d130c3c41';
              return original(key);
            }) as typeof real.getOrThrow;
            return real;
          },
        },
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
    await dataSource.query(
      `DELETE
       FROM "users"
       WHERE email LIKE '%@refresh-test.com'`,
    );
    await app.close();
  });

  const registerSeedUser = async (email: string) => {
    const response = await request(httpServer)
      .post('/auth/register')
      .send({ email, password: 'securepassword', username: 'refreshuser' });
    return response.body as { accessToken: string; refreshToken: string };
  };

  // ─── 200 OK — rotation ────────────────────────────────────────────

  describe('200 OK — rotation', () => {
    it('should return a new token pair for a valid refresh token', async () => {
      const { refreshToken } = await registerSeedUser(
        'rotate1@refresh-test.com',
      );

      const response = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const body = response.body as {
        accessToken: string;
        refreshToken: string;
      };
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.refreshToken).not.toBe(refreshToken);
    });

    it('should return the same user profile that was registered', async () => {
      const { refreshToken } = await registerSeedUser(
        'rotate2@refresh-test.com',
      );

      const response = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const body = response.body as { user: { email: string } };
      expect(body.user.email).toBe('rotate2@refresh-test.com');
    });

    it('should reject the old refresh token after rotation (single use)', async () => {
      const { refreshToken: firstToken } = await registerSeedUser(
        'rotate3@refresh-test.com',
      );

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: firstToken })
        .expect(200);

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: firstToken })
        .expect(401);
    });
  });

  // ─── 401 — replay forces full re-authentication ──────────────────

  describe('401 — replay detection clears the session', () => {
    it('should invalidate the current valid token after a replay of an old token', async () => {
      const { refreshToken: tokenV1 } = await registerSeedUser(
        'replay1@refresh-test.com',
      );

      const rotateResponse = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokenV1 })
        .expect(200);
      const { refreshToken: tokenV2 } = rotateResponse.body as {
        refreshToken: string;
      };

      // Replay the old (already-rotated) token — should fail and clear the session.
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokenV1 })
        .expect(401);

      // The legitimate, still-unexpired tokenV2 is now also rejected because
      // the stored hash was cleared, forcing re-authentication.
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokenV2 })
        .expect(401);
    });
  });

  // ─── 401 — invalid / expired tokens ───────────────────────────────

  describe('401 — invalid or expired token', () => {
    it('should return 401 for a token signed with the wrong secret', async () => {
      const forgedToken = sign(
        { sub: '550e8400-e29b-41d4-a716-446655440000', type: 'refresh' },
        'wrong-secret-entirely',
        { expiresIn: '7d' },
      );

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: forgedToken })
        .expect(401);
    });

    it('should return 401 for an expired refresh token', async () => {
      const expiredToken = sign(
        {
          sub: '550e8400-e29b-41d4-a716-446655440000',
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        REFRESH_SECRET,
      );

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);
    });

    it('should return 401 for a well-formed token with an unknown user id', async () => {
      const tokenForUnknownUser = sign(
        { sub: '00000000-0000-4000-8000-000000000000', type: 'refresh' },
        REFRESH_SECRET,
        { expiresIn: '7d' },
      );

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokenForUnknownUser })
        .expect(401);
    });

    it('should return 401 for an access token presented as a refresh token (type confusion)', async () => {
      const { accessToken } = await registerSeedUser(
        'typeconfusion@refresh-test.com',
      );

      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);
    });
  });

  // ─── 400 — malformed input ─────────────────────────────────────────

  describe('400 Bad Request', () => {
    it('should return 400 when refreshToken is missing', async () => {
      await request(httpServer).post('/auth/refresh').send({}).expect(400);
    });

    it('should return 400 when refreshToken is not a well-formed JWT', async () => {
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-jwt' })
        .expect(400);
    });
  });
});
