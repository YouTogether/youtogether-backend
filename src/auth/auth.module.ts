import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthRepositoryImpl } from './data/repositories/auth-repository.impl';
import { TokenService } from './data/services/token.service';
import { UserOrmEntity } from './data/entities/user.orm-entity';
import { IAuthRepository } from './domain/repositories/auth-repository.interface';
import { RegisterUseCase } from './domain/usecases/register.usecase';
import { AuthController } from './presentation/controllers/auth.controller';

/**
 * NestJS module for the Authentication bounded context.
 *
 * Wires together all layers of the Clean Architecture:
 * - Domain layer: {@link RegisterUseCase} and {@link IAuthRepository} (port).
 * - Data layer: {@link AuthRepositoryImpl} (port implementation), {@link TokenService}.
 * - Presentation layer: {@link AuthController}.
 *
 * The {@link IAuthRepository} abstract class is bound to {@link AuthRepositoryImpl}
 * via the `useClass` provider, implementing the dependency inversion principle.
 * Domain use cases depend on the abstract port; the module resolves the
 * concrete implementation at runtime.
 *
 * JWT configuration is deferred to {@link JwtModule.registerAsync} to read
 * secrets from environment variables via {@link ConfigService}, ensuring that
 * secrets are never hardcoded.
 *
 * @see RegisterUseCase
 * @see AuthRepositoryImpl
 * @see TokenService
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    TokenService,
    {
      provide: IAuthRepository,
      useClass: AuthRepositoryImpl,
    },
  ],
  exports: [TokenService],
})
export class AuthModule {}
