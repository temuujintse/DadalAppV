import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { HabitsModule } from '../habits/habits.module';
import { PetsModule } from '../pets/pets.module';
import { QuestsModule } from '../quests/quests.module';
import { StreaksModule } from '../streaks/streaks.module';
import { CompletionsController } from './completions.controller';
import { CompletionsService } from './completions.service';

@Module({
  imports: [HabitsModule, StreaksModule, GamificationModule, PetsModule, QuestsModule],
  controllers: [CompletionsController],
  providers: [CompletionsService],
  exports: [CompletionsService],
})
export class CompletionsModule {}
