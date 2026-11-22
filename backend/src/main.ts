import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp, setupSwagger } from './app.setup';
import type { Env } from './config/env';
import { PrismaService } from './database/prisma.service';
import { seedReferenceData } from './database/reference-data';

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

  // After listening, so slow hosts see an open port right away; upserts are idempotent.
  if (config.get('SEED_ON_BOOT', { infer: true })) {
    seedReferenceData(app.get(PrismaService))
      .then((r) =>
        logger.log(
          `Reference data: ${r.achievements} achievements, ${r.accessories} accessories, ${r.quests} quests`,
        ),
      )
      .catch((err: unknown) => logger.error(`Reference data seed failed: ${String(err)}`));
  }
  if (swaggerEnabled) logger.log(`Swagger UI on http://localhost:${port}/${API_PREFIX}/docs`);
}

void bootstrap();
