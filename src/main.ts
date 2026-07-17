import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

/**
 * Application bootstrap.
 *
 * Additions:
 * - **B-INF-T1**: a global `ValidationPipe` (`whitelist: true`,
 *   `forbidNonWhitelisted: true`), matching the configuration every
 *   integration test in this codebase has assumed and re-declared
 *   individually since B-R01-T2. Declaring it once here, globally, is
 *   the production equivalent of what those tests already exercise
 *   per-suite. Also, the Swagger/OpenAPI document, served at
 *   `/api-docs`, generated from the `@ApiTags`/`@ApiOperation`/
 *   `@ApiResponse`/`@ApiProperty` decorators on controllers and DTOs
 *   across both bounded contexts.
 * - **B-INF-T2**: URI-based API versioning (`setGlobalPrefix('api')` +
 *   `enableVersioning({ type: URI, defaultVersion: '1' })`), so every
 *   route is reachable at `/api/v1/...` (e.g. `/api/v1/auth/login`,
 *   `/api/v1/rooms`). No controller declares its own `version` — the
 *   default applies uniformly across the whole API, which is
 *   appropriate while there is only ever one version in existence.
 *   `SwaggerModule.setup()` registers its own route directly on the
 *   underlying HTTP adapter rather than through Nest's controller
 *   routing, so `/api-docs` is deliberately unaffected by both the
 *   global prefix and the versioning scheme — the documentation itself
 *   is not versioned.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('YouTogether API')
    .setDescription(
      'REST API for the YouTogether synchronized watch-party application.',
    )
    .setVersion('1.0')
    .addTag(
      'Authentication',
      'Registration, login, session refresh, logout, and profile retrieval.',
    )
    .addTag(
      'Rooms',
      'Creating, browsing, updating, deleting, joining, and leaving watch-party rooms.',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
