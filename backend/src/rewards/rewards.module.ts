import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { GamificationModule } from '../gamification/gamification.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [FamiliesModule, GamificationModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
