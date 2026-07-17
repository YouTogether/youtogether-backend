import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { LoginUseCase } from '../../../../src/auth/domain/usecases/login.usecase';
import { LogoutUseCase } from '../../../../src/auth/domain/usecases/logout.usecase';
import { RefreshUseCase } from '../../../../src/auth/domain/usecases/refresh.usecase';
import { GetCurrentUserUseCase } from '../../../../src/auth/domain/usecases/get-current-user.usecase';
import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Shape of the successful authentication response body (HTTP 200).
 * Mirrors AuthResponseDto — typed explicitly to eliminate `any` member access.
 */
interface AuthSuccessBody {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Shape of the NestJS error response body (HTTP 4xx).
 */
interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Integration tests for POST /auth/login.
 *
 * A registered test user is seeded in beforeAll via POST /auth/register.
 * All login scenarios run against that seeded user.
 *
 * Scenarios covered:
 * - 200 OK:  valid credentials, response contains profile and tokens.
 * - 401:     wrong password.
 * - 401:     unknown email.
 * - 401:     soft-deleted user.
 * - 400:     missing/invalid fields.
 * - Security: 401 message is identical for wrong password and unknown email.
 *
 * @competency Integration test harness.
 * @competency Acceptance test scenarios TC-01, TC-02.
 */
describe('POST /auth/login (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

  const SEED_EMAIL = 'login-test@integration.com';
  const SEED_PASSWORD = 'correctpassword';
  const SEED_USERNAME = 'loginuser';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
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
            // No dropSchema: see register.integration.spec.ts for the
            // rationale (parallel-worker safety with idempotent migrations).
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
            secret: cs.get<string>(
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
        GetCurrentUserUseCase,
        TokenService,
        JwtStrategy,
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

    await request(httpServer).post('/auth/register').send({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      username: SEED_USERNAME,
    });
  });

  afterAll(async () => {
    await dataSource.query(`DELETE
                            FROM "users"
                            WHERE email LIKE '%@integration.com'`);
    await app.close();
  });

  // --- 200 OK ---

  describe('200 OK', () => {
    it('should return user profile and tokens on valid credentials', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200);

      const body = response.body as AuthSuccessBody;
      expect(body.user.email).toBe(SEED_EMAIL);
      expect(body.user.username).toBe(SEED_USERNAME);
      expect(body.user.role).toBe('registered');
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken.split('.')).toHaveLength(3);
    });

    it('should return a valid three-part JWT access token', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200);

      const body = response.body as AuthSuccessBody;
      expect(body.accessToken.split('.')).toHaveLength(3);
    });

    it('should not include passwordHash or refreshTokenHash in the response', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200);

      const body = response.body as AuthSuccessBody & Record<string, unknown>;
      const user = body.user as Record<string, unknown>;
      expect(user.passwordHash).toBeUndefined();
      expect(user.refreshTokenHash).toBeUndefined();
    });
  });

  // --- 401 Unauthorized ---

  describe('401 Unauthorized', () => {
    it('should return 401 when password is wrong', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL, password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 when email is unknown', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: 'nobody@integration.com', password: SEED_PASSWORD })
        .expect(401);
    });

    it('should return the same generic message for wrong password and unknown email', async () => {
      const wrongPasswordResponse = await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL, password: 'wrongpassword' });

      const unknownEmailResponse = await request(httpServer)
        .post('/auth/login')
        .send({ email: 'nobody@integration.com', password: SEED_PASSWORD });

      const wrongBody = wrongPasswordResponse.body as ErrorBody;
      const unknownBody = unknownEmailResponse.body as ErrorBody;
      expect(wrongBody.message).toBe(unknownBody.message);
    });

    it('should not reveal whether the email exists in the error message', async () => {
      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: 'nobody@integration.com', password: 'anything' })
        .expect(401);

      const body = response.body as ErrorBody;
      const message = (
        Array.isArray(body.message) ? body.message.join(' ') : body.message
      ).toLowerCase();

      // The message must not disclose WHICH part of the credentials was wrong,
      // nor whether the account exists. Phrasings that would leak this are
      // forbidden; the generic "invalid email or password" is acceptable
      // because it covers both cases identically.
      expect(message).not.toContain('not found');
      expect(message).not.toContain('does not exist');
      expect(message).not.toContain('no account');
      expect(message).not.toContain('unknown user');
      expect(message).not.toContain('wrong password');
      expect(message).not.toContain('incorrect password');
    });

    it('should return 401 when the user account is soft-deleted', async () => {
      await request(httpServer).post('/auth/register').send({
        email: 'deleted-login@integration.com',
        password: 'pass1234!',
        username: 'del',
      });

      await dataSource.query(
        `UPDATE "users"
         SET deleted_at = now()
         WHERE email = 'deleted-login@integration.com'`,
      );

      await request(httpServer)
        .post('/auth/login')
        .send({ email: 'deleted-login@integration.com', password: 'pass1234!' })
        .expect(401);
    });
  });

  // --- 400 Bad Request ---

  describe('400 Bad Request', () => {
    it('should return 400 when email is missing', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ password: SEED_PASSWORD })
        .expect(400);
    });

    it('should return 400 when email format is invalid', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: 'not-an-email', password: SEED_PASSWORD })
        .expect(400);
    });

    it('should return 400 when password is missing', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL })
        .expect(400);
    });

    it('should return 400 when unknown fields are present (whitelist)', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD, extra: 'field' })
        .expect(400);
    });
  });
});
