import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { AchievementsService } from './achievements.service';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { XpLedgerService } from './xp-ledger.service';

@Module({
  imports: [FamiliesModule],
  controllers: [GamificationController],
  providers: [XpLedgerService, AchievementsService, GamificationService],
  exports: [XpLedgerService, AchievementsService, GamificationService],
})
export class GamificationModule {}
