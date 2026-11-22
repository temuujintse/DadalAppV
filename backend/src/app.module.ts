import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './common/audit/audit.service';
import { CompletionsModule } from './completions/completions.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { isSensitiveRoute } from './common/guards/rate-limit';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/validation';
import { Env, validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { FamiliesModule } from './families/families.module';
import { GamificationModule } from './gamification/gamification.module';
import { HabitsModule } from './habits/habits.module';
import { HealthController } from './health/health.controller';
import { InvitesModule } from './invites/invites.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PetsModule } from './pets/pets.module';
import { QuestsModule } from './quests/quests.module';
import { RewardsModule } from './rewards/rewards.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Tests inject their own env (see `npm run test:e2e`); otherwise read .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: config.get('RATE_LIMIT_DEFAULT', { infer: true }),
          },
          {
            name: 'sensitive',
            ttl: 60_000,
            limit: config.get('RATE_LIMIT_AUTH', { infer: true }),
            skipIf: (context) => !isSensitiveRoute(context),
          },
        ],
      }),
    }),
    DatabaseModule,
    AuditModule,
    MailModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    FamiliesModule,
    InvitesModule,
    HabitsModule,
    CompletionsModule,
    GamificationModule,
    PetsModule,
    QuestsModule,
    RewardsModule,
    SyncModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limiting runs before authentication.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
