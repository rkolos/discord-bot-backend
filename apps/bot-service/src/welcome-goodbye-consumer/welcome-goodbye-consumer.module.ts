import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildWelcomeGoodbyeSetting } from '@app/shared';
import { WelcomeGoodbyeConfigConsumerService } from './welcome-goodbye-config-consumer.service';

@Module({
  imports: [TypeOrmModule.forFeature([GuildWelcomeGoodbyeSetting])],
  providers: [WelcomeGoodbyeConfigConsumerService],
})
export class WelcomeGoodbyeConsumerModule {}
