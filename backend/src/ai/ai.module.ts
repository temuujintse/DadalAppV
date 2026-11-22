import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module';
import { AIController } from './ai.controller';
import { AIOrchestrator } from './ai-orchestrator.service';
import { AnalyticsService } from './analytics/analytics.service';
import { PetCompanionService } from './pet/pet-companion.service';
import { PlannerService } from './planner/planner.service';
import { AI_PROVIDER } from './ai-provider.interface';
import { CoachService } from './coach/coach.service';
import { CoachContextService } from './context/coach-context.service';
import { AIPreferencesService } from './preferences.service';
import { OpenAIProvider } from './providers/openai/openai.provider';

/**
 * AI features: Coach, Smart Planner, Pet companion, Analytics. The provider is bound by
 * token so tests and future providers can replace OpenAI without touching business code.
 */
@Module({
  imports: [HabitsModule],
  controllers: [AIController],
  providers: [
    { provide: AI_PROVIDER, useClass: OpenAIProvider },
    AIOrchestrator,
    CoachContextService,
    CoachService,
    AIPreferencesService,
    PlannerService,
    PetCompanionService,
    AnalyticsService,
  ],
})
export class AIModule {}
