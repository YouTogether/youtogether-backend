import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { RoomModule } from './room/room.module';

/**
 * Root application module.
 *
 * Wires the two bounded-context modules ({@link AuthModule},
 * {@link RoomModule}) into the running application. This
 * module had an empty `imports` array: each bounded context's own
 * `TypeOrmModule.forFeature` calls could compile in isolation, but the
 * application had no `TypeOrmModule.forRoot` connection to attach to and
 * neither `AuthModule` nor `RoomModule` was ever actually registered
 * here — meaning `npm run start:dev` could not previously boot a
 * functional server. Generating genuinely useful Swagger documentation
 * requires a running application, which is what surfaced this gap;
 * closing it here rather than leaving it for a later, unrelated task.
 *
 * Database migrations are run explicitly via `npm run migration:run`
 * (see package.json), not automatically on boot — `migrationsRun` is
 * deliberately omitted (defaults to `false`) to keep schema changes an
 * explicit, reviewable step.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'youtogether'),
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
    RoomModule,
  ],
})
export class AppModule {}
