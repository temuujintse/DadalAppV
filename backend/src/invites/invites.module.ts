import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [FamiliesModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
