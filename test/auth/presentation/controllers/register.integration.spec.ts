import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';
import { AuthController } from '../../../../src/auth/presentation/controllers/auth.controller';
import { DomainExceptionFilter } from '../../../../src/auth/presentation/filters/domain-exception.filter';
import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Shape of the successful registration response body (HTTP 201).
 * Mirrors AuthResponseDto — typed explicitly to eliminate `any` member access.
 */
interface RegisterSuccessBody {
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
 * Integration tests for POST /auth/register.
 *
 * Boots a minimal NestJS application with a real PostgreSQL test database.
 * Uses supertest to send HTTP requests against the live application.
 *
 * Scenarios covered:
 * - 201 Created: valid payload, user created, tokens returned.
 * - 409 Conflict: duplicate email among active users.
 * - 400 Bad Request: missing fields, invalid email, short password.
 *
 * Prerequisites:
 * - A PostgreSQL test database (env: DB_TEST_DATABASE).
 * - Migration executed before tests (handled via migrationsRun).
 *
 * @competency Integration test harness.
 * @competency Test scenarios and expected results (cahier de recette).
 */
describe('POST /auth/register (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5432),
            username: configService.get<string>('DB_USERNAME', 'postgres'),
            password: configService.get<string>('DB_PASSWORD', 'postgres'),
            database: configService.get<string>(
              'DB_TEST_DATABASE',
              'youtogether_test',
            ),
            entities: [UserOrmEntity],
            migrations: [CreateUsersTable1714000000000],
            migrationsRun: true,
            synchronize: false,
            logging: false,
          }),
        }),
        TypeOrmModule.forFeature([UserOrmEntity]),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>(
              'JWT_SECRET',
              'test-secret-min-32-chars-long!!',
            ),
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        RegisterUseCase,
        TokenService,
        { provide: IAuthRepository, useClass: AuthRepositoryImpl },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    // Retrieve typed references once — avoids repeated unsafe casts in tests.
    // getDataSourceToken() returns the DI token for the default DataSource.
    httpServer = app.getHttpServer() as Server;
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Remove test-specific rows without affecting unrelated data.
    await dataSource.query(
      `DELETE
       FROM "users"
       WHERE email LIKE '%@integration-test.com'`,
    );
  });

  // ─── 201 Created ──────────────────────────────────────────────────

  describe('201 Created', () => {
    it('should create a user and return user profile with tokens', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'valid@integration-test.com',
          password: 'securepassword',
          username: 'integrationuser',
        })
        .expect(201);

      const body = response.body as RegisterSuccessBody;

      expect(body.user.email).toBe('valid@integration-test.com');
      expect(body.user.username).toBe('integrationuser');
      expect(body.user.role).toBe(UserRole.REGISTERED);
      expect(body.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should not include passwordHash or refreshTokenHash in the response', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'noleak@integration-test.com',
          password: 'securepassword',
          username: 'noleakuser',
        })
        .expect(201);

      const body = response.body as RegisterSuccessBody &
        Record<string, unknown>;
      const user = body.user as RegisterSuccessBody['user'] &
        Record<string, unknown>;

      expect(user.passwordHash).toBeUndefined();
      expect(user.refreshTokenHash).toBeUndefined();
    });

    it('should return a well-formed JWT access token', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'jwt@integration-test.com',
          password: 'securepassword',
          username: 'jwtuser',
        })
        .expect(201);

      const body = response.body as RegisterSuccessBody;
      const parts = body.accessToken.split('.');

      expect(parts).toHaveLength(3);
    });
  });

  // ─── 409 Conflict ─────────────────────────────────────────────────

  describe('409 Conflict', () => {
    it('should return 409 when the email is already registered to an active user', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'duplicate@integration-test.com',
          password: 'securepassword',
          username: 'firstuser',
        })
        .expect(201);

      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'duplicate@integration-test.com',
          password: 'anotherpassword',
          username: 'seconduser',
        })
        .expect(409);
    });

    it('should include the conflicting email in the 409 error message', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'msg409@integration-test.com',
          password: 'pass1234',
          username: 'u1',
        })
        .expect(201);

      const response = await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'msg409@integration-test.com',
          password: 'pass5678',
          username: 'u2',
        })
        .expect(409);

      const body = response.body as ErrorBody;

      expect(body.message).toContain('msg409@integration-test.com');
    });
  });

  // ─── 400 Bad Request ──────────────────────────────────────────────

  describe('400 Bad Request', () => {
    it('should return 400 when email is missing', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ password: 'securepassword', username: 'user' })
        .expect(400);
    });

    it('should return 400 when email is not a valid address', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'securepassword',
          username: 'user',
        })
        .expect(400);
    });

    it('should return 400 when password is shorter than 8 characters', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'short@integration-test.com',
          password: '1234567',
          username: 'user',
        })
        .expect(400);
    });

    it('should return 400 when username is missing', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'nousername@integration-test.com',
          password: 'securepassword',
        })
        .expect(400);
    });

    it('should return 400 when username exceeds 50 characters', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'longname@integration-test.com',
          password: 'securepassword',
          username: 'a'.repeat(51),
        })
        .expect(400);
    });

    it('should return 400 when unknown fields are sent (whitelist enforcement)', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: 'extra@integration-test.com',
          password: 'securepassword',
          username: 'user',
          role: 'admin',
        })
        .expect(400);
    });
  });
});
