import { Module } from '@nestjs/common';
import { CompletionsModule } from '../completions/completions.module';
import { FamiliesModule } from '../families/families.module';
import { GamificationModule } from '../gamification/gamification.module';
import { HabitsModule } from '../habits/habits.module';
import { PetsModule } from '../pets/pets.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [CompletionsModule, PetsModule, HabitsModule, FamiliesModule, GamificationModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
