import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PhotosService } from './photos.service';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PhotosService],
  exports: [UsersService],
})
export class UsersModule {}
