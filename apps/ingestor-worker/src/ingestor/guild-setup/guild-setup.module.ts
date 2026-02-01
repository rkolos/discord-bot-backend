import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild, ServerSettings, User } from '@app/shared';
import { GuildSetupConsumer } from './guild-setup.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Guild, ServerSettings, User])],
  providers: [GuildSetupConsumer],
})
export class GuildSetupModule {}
