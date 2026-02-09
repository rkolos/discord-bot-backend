import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule, Guild, GuildLogSetting, GuildWelcomeGoodbyeSetting } from '@app/shared';
import { ServerSettings } from '@app/shared';
import { GuildSyncModule } from '../guild-sync/guild-sync.module';
import { CommandsModule } from '../commands/commands.module';
import { RawEventsModule } from '../raw-events/raw-events.module';
import { CountersQueueProducerModule } from '../counters-queue-producer/counters-queue-producer.module';
import { MultiTokenConnectionManagerService } from './multi-token-connection-manager.service';
import { MultiTokenEventsService } from './multi-token-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServerSettings, Guild, GuildLogSetting, GuildWelcomeGoodbyeSetting]),
    CryptoModule,
    GuildSyncModule,
    CommandsModule,
    RawEventsModule,
    CountersQueueProducerModule,
  ],
  providers: [MultiTokenConnectionManagerService, MultiTokenEventsService],
  exports: [MultiTokenConnectionManagerService],
})
export class MultiTokenModule {}
