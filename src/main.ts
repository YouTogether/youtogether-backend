import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('YouTogether API')
    .setDescription(
      'REST API for the YouTogether platform — a synchronized watch-party ' +
        'application. Covers the Authentication and Room bounded contexts. ' +
        'Video Synchronisation state is transported over Firebase Realtime ' +
        'Database and is documented separately.',
    )
    .setVersion('1.0.0')
    .addTag('Authentication', 'Registration, login, session lifecycle')
    .addTag('Rooms', 'Watch-party room lifecycle and membership')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token issued by POST /auth/register or POST /auth/login',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  // OWASP A05:2021 (Security Misconfiguration) — the schema is only
  // exposed by default outside production. Set ENABLE_SWAGGER=true to
  // override explicitly if the jury needs to reach it in a prod-like env.
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true';

  if (swaggerEnabled) {
    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
