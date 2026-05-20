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
import { AuthController } from './presentation/controllers/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { JwtStrategy } from './presentation/strategies/jwt.strategy';

/**
 * NestJS module for the Authentication bounded context.
 *
 * Wires together all layers of the Clean Architecture:
 * - Domain layer: {@link RegisterUseCase} and {@link IAuthRepository} (port).
 * - Data layer: {@link AuthRepositoryImpl}, {@link TokenService}.
 * - Presentation layer: {@link AuthController}, {@link JwtStrategy},
 *   {@link JwtAuthGuard}.
 *
 * The {@link IAuthRepository} abstract class is bound to {@link AuthRepositoryImpl}
 * via the `useClass` provider, implementing the dependency inversion principle.
 *
 * {@link PassportModule} registers the default strategy as `'jwt'`. The
 * {@link JwtStrategy} and {@link JwtAuthGuard} are exported so that other
 * modules (room, video) can protect their own routes without redefining
 * authentication logic.
 *
 * JWT configuration is deferred to {@link JwtModule.registerAsync} to read
 * secrets from environment variables via {@link ConfigService}.
 *
 * @see JwtStrategy
 * @see JwtAuthGuard
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
