import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StringValue } from 'ms';

import { AuthRepositoryImpl } from './data/repositories/auth-repository.impl';
import { TokenService } from './data/services/token.service';
import { UserOrmEntity } from './data/entities/user.orm-entity';
import { IAuthRepository } from './domain/repositories/auth-repository.interface';
import { RegisterUseCase } from './domain/usecases/register.usecase';
import { LoginUseCase } from './domain/usecases/login.usecase';
import { RefreshUseCase } from './domain/usecases/refresh.usecase';
import { AuthController } from './presentation/controllers/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { JwtStrategy } from './presentation/strategies/jwt.strategy';

/**
 * NestJS module for the Authentication bounded context.
 *
 * Use cases registered: {@link RegisterUseCase}, {@link LoginUseCase},
 * {@link RefreshUseCase}. All delegate to {@link IAuthRepository} bound to
 * {@link AuthRepositoryImpl}.
 *
 * Required environment variables (see {@link TokenService}):
 * - `JWT_SECRET` — access token signing secret.
 * - `JWT_ACCESS_EXPIRATION` — access token TTL (default '15m').
 * - `JWT_REFRESH_SECRET` — refresh token signing secret (REQUIRED; must differ from JWT_SECRET).
 * - `JWT_REFRESH_EXPIRATION` — refresh token TTL (default '7d').
 *
 * {@link JwtAuthGuard} and {@link PassportModule} are exported for reuse
 * in room and video modules.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    {
      provide: IAuthRepository,
      useClass: AuthRepositoryImpl,
    },
  ],
  exports: [TokenService, JwtAuthGuard, PassportModule],
})
export class AuthModule {}
