import { Module } from '@nestjs/common';
import { SharedAnalyticsModule } from '@app/shared';
import { UserDataController } from './user-data.controller';
import { UserDataService } from './user-data.service';
import { GdprUserDeleteQueueService } from './gdpr-user-delete-queue.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, SharedAnalyticsModule],
  controllers: [UserDataController],
  providers: [UserDataService, GdprUserDeleteQueueService],
  exports: [UserDataService, GdprUserDeleteQueueService],
})
export class UserDataModule {}
