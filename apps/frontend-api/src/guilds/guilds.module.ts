import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CryptoModule, SharedAnalyticsModule } from '@app/shared';
import { Guild, GuildModule, ServerSettings, CompanyMember } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { GuildsController } from './guilds.controller';
import { GuildsService } from './guilds.service';
import { HistorySyncQueueService } from './history-sync-queue.service';
import { GuildAdminGuard } from './guards/guild-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildModule, ServerSettings, CompanyMember]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 0,
    }),
    CryptoModule,
    SharedAnalyticsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [GuildsController],
  providers: [GuildsService, GuildAdminGuard, HistorySyncQueueService],
  exports: [GuildsService, GuildAdminGuard],
})
export class GuildsModule {}
