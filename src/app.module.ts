import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { RoomModule } from './room/room.module';
import { VideoSyncModule } from './video-sync/video-sync.module';

/**
 * Root application module.
 *
 * Wires the three bounded-context modules ({@link AuthModule},
 * {@link RoomModule}, {@link VideoSyncModule}) into the running
 * application.
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
    VideoSyncModule,
  ],
})
export class AppModule {}
