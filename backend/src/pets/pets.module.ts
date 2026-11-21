import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { QuestsModule } from '../quests/quests.module';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

@Module({
  imports: [GamificationModule, QuestsModule],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
