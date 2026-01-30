import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule, Guild } from '@app/shared';
import { ServerSettings } from '@app/shared';
import { GuildSyncModule } from '../guild-sync/guild-sync.module';
import { CommandsModule } from '../commands/commands.module';
import { MultiTokenConnectionManagerService } from './multi-token-connection-manager.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServerSettings, Guild]),
    CryptoModule,
    GuildSyncModule,
    CommandsModule,
  ],
  providers: [MultiTokenConnectionManagerService],
  exports: [MultiTokenConnectionManagerService],
})
export class MultiTokenModule {}
