import { Module } from '@nestjs/common';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamilyAccessService } from './family-access.service';

@Module({
  controllers: [FamiliesController],
  providers: [FamiliesService, FamilyAccessService],
  exports: [FamiliesService, FamilyAccessService],
})
export class FamiliesModule {}
