import { Module } from '@nestjs/common';
import { UserDataController } from './user-data.controller';
import { UserDataService } from './user-data.service';
import { GdprUserDeleteQueueService } from './gdpr-user-delete-queue.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserDataController],
  providers: [UserDataService, GdprUserDeleteQueueService],
  exports: [UserDataService, GdprUserDeleteQueueService],
})
export class UserDataModule {}
