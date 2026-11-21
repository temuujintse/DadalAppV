import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { GamificationModule } from '../gamification/gamification.module';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

@Module({
  imports: [FamiliesModule, GamificationModule],
  controllers: [QuestsController],
  providers: [QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}
