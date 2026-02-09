import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildWelcomeGoodbyeSetting } from '@app/shared';
import { GuildsModule } from '../guilds/guilds.module';
import { WelcomeGoodbyeController } from './welcome-goodbye.controller';
import { WelcomeGoodbyeService } from './welcome-goodbye.service';
import { WelcomeGoodbyeQueueService } from './welcome-goodbye-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GuildWelcomeGoodbyeSetting]),
    GuildsModule,
  ],
  controllers: [WelcomeGoodbyeController],
  providers: [WelcomeGoodbyeService, WelcomeGoodbyeQueueService],
  exports: [WelcomeGoodbyeService],
})
export class WelcomeGoodbyeModule {}
