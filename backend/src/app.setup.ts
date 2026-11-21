import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './config/env';

export const API_PREFIX = 'api/v1';

/** HTTP-level setup shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());

  const origins = config.get('CORS_ORIGINS', { infer: true }).trim();
  app.enableCors({
    origin: origins === '*' ? true : origins.split(',').map((o) => o.trim()),
    credentials: false,
    exposedHeaders: ['x-request-id'],
  });

  if (isProd) {
    // Behind a reverse proxy / load balancer: trust the first hop for req.ip (rate limiting).
    (app as NestExpressApplication).set('trust proxy', 1);
  }
}

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Family Habit API')
      .setDescription(
        'Build better habits together. Every response is wrapped as ' +
          '`{ success: true, data, meta? }` or `{ success: false, error: { code, message, details?, requestId } }`.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
    jsonDocumentUrl: `${API_PREFIX}/docs-json`,
  });
}
