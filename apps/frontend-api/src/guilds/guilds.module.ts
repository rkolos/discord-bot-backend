import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CryptoModule, SharedAnalyticsModule } from '@app/shared';
import { Guild, GuildModule, ServerSettings, CompanyMember } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { GuildsController } from './guilds.controller';
import { GuildsRealtimeService } from './guilds-realtime.service';
import { GuildsService } from './guilds.service';
import { HistorySyncQueueService } from './history-sync-queue.service';
import { GuildAdminGuard } from './guards/guild-admin.guard';
import { GuildContextService } from './guild-context.service';

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
  providers: [
    GuildsService,
    GuildsRealtimeService,
    GuildAdminGuard,
    GuildContextService,
    HistorySyncQueueService,
  ],
  exports: [GuildsService, GuildsRealtimeService, GuildAdminGuard, GuildContextService],
})
export class GuildsModule {}
