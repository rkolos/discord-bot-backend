import { Module } from '@nestjs/common';
import { CryptoModule, Guild, ServerSettings, SharedAnalyticsModule } from '@app/shared';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandsModule } from '../commands/commands.module';
import { InternalAnalyticsController } from './internal-analytics.controller';
import { InternalCommandsController } from './internal-commands.controller';
import { InternalGuildSyncController } from './internal-guild-sync.controller';
import { GuildSyncInternalService } from './guild-sync-internal.service';

@Module({
  imports: [
    SharedAnalyticsModule,
    CommandsModule,
    CryptoModule,
    TypeOrmModule.forFeature([Guild, ServerSettings]),
  ],
  controllers: [
    InternalAnalyticsController,
    InternalCommandsController,
    InternalGuildSyncController,
  ],
  providers: [GuildSyncInternalService],
})
export class InternalModule {}
