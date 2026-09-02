import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StringValue } from 'ms';

import { FirebaseModule } from '../firebase/firebase.module';
import { AuthRepositoryImpl } from './data/repositories/auth-repository.impl';
import { FirebaseAuthProviderService } from './data/services/firebase-auth-provider.service';
import { TokenService } from './data/services/token.service';
import { UserOrmEntity } from './data/entities/user.orm-entity';
import { IAuthRepository } from './domain/repositories/auth-repository.interface';
import { IFirebaseAuthProvider } from './domain/repositories/firebase-auth-provider.interface';
import { RegisterUseCase } from './domain/usecases/register.usecase';
import { LoginUseCase } from './domain/usecases/login.usecase';
import { RefreshUseCase } from './domain/usecases/refresh.usecase';
import { LogoutUseCase } from './domain/usecases/logout.usecase';
import { GetCurrentUserUseCase } from './domain/usecases/get-current-user.usecase';
import { IssueFirebaseTokenUseCase } from './domain/usecases/issue-firebase-token.usecase';
import { AuthController } from './presentation/controllers/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { JwtStrategy } from './presentation/strategies/jwt.strategy';

/**
 * NestJS module for the Authentication bounded context.
 *
 * Use cases registered: {@link RegisterUseCase}, {@link LoginUseCase},
 * {@link RefreshUseCase}, {@link LogoutUseCase}, {@link GetCurrentUserUseCase},
 * {@link IssueFirebaseTokenUseCase}. The first five delegate to
 * {@link IAuthRepository} bound to {@link AuthRepositoryImpl}; the last
 * additionally delegates to {@link IFirebaseAuthProvider} bound to
 * {@link FirebaseAuthProviderService}.
 *
 * Required environment variables (see {@link TokenService}):
 * - `JWT_SECRET` — access token signing secret.
 * - `JWT_ACCESS_EXPIRATION` — access token TTL (default '15m').
 * - `JWT_REFRESH_SECRET` — refresh token signing secret (REQUIRED; must differ from JWT_SECRET).
 * - `JWT_REFRESH_EXPIRATION` — refresh token TTL (default '7d').
 *
 * Plus the four `FIREBASE_*` variables required by
 * {@link FirebaseAdminService}, already needed by `VideoSyncModule`
 * since B-V03 — this module is the second consumer of the same shared
 * {@link FirebaseModule}, not a second Firebase application.
 *
 * {@link JwtAuthGuard} and {@link PassportModule} are exported for reuse
 * in room and video modules. This module now hosts three guarded routes
 * (POST /auth/logout, GET /auth/me, POST /auth/firebase-token).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    FirebaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<StringValue>(
            'JWT_ACCESS_EXPIRATION',
            '15m',
          ),
        },
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
    {
      provide: IAuthRepository,
      useClass: AuthRepositoryImpl,
    },
    {
      provide: IFirebaseAuthProvider,
      useClass: FirebaseAuthProviderService,
    },
  ],
  exports: [TokenService, JwtAuthGuard, PassportModule],
})
export class AuthModule {}
