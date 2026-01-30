import {
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommandsModule } from './commands/commands.module';
import { GuildSyncModule } from './guild-sync/guild-sync.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { MultiTokenModule } from './multi-token/multi-token.module';
import { RawEventsModule } from './raw-events/raw-events.module';
import { ShardingModule } from './sharding/sharding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    GuildSyncModule,
    ShardingModule,
    MultiTokenModule,
    CommandsModule,
    RawEventsModule,
    InternalModule,
    HealthModule,
  ],
})
export class AppModule {}
