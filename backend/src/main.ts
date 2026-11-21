import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp, setupSwagger } from './app.setup';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // Structured JSON logs in production (ready for log shipping), readable logs locally.
    logger: new ConsoleLogger({ json: isProd, prefix: 'FamilyHabit' }),
  });
  const config = app.get(ConfigService<Env, true>);

  configureApp(app);
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true }) ?? !isProd;
  if (swaggerEnabled) setupSwagger(app);

  app.enableShutdownHooks();
  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API ready on http://localhost:${port}/${API_PREFIX}`);
  if (swaggerEnabled) logger.log(`Swagger UI on http://localhost:${port}/${API_PREFIX}/docs`);
}

void bootstrap();
