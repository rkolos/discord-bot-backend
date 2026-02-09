import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild, ServerSettings, SharedAnalyticsModule, SharedConfigModule, SharedConfigService } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { GuildsModule } from '../guilds/guilds.module';
import { GuildStateGateway } from './guild-state.gateway';
import { GuildStateRedisSubscriberService } from './guild-state-redis-subscriber.service';
import { RealtimeBootstrapController } from './realtime-bootstrap.controller';
import { RealtimeBootstrapService } from './realtime-bootstrap.service';
import { RealtimeFullStateService } from './realtime-full-state.service';
import { RealtimeInitializerService } from './realtime-initializer.service';
import { RealtimeSocketService } from './realtime-socket.service';
import { RealtimeStateController } from './realtime-state.controller';

@Module({
  imports: [
    SharedConfigModule,
    SharedAnalyticsModule,
    TypeOrmModule.forFeature([Guild, ServerSettings]),
    JwtModule.registerAsync({
      imports: [SharedConfigModule],
      useFactory: (sharedConfig: SharedConfigService) => ({
        secret: sharedConfig.auth.jwtSecret,
      }),
      inject: [SharedConfigService],
    }),
    AuthModule,
    GuildsModule,
  ],
  controllers: [RealtimeBootstrapController, RealtimeStateController],
  providers: [
    GuildStateGateway,
    GuildStateRedisSubscriberService,
    RealtimeBootstrapService,
    RealtimeFullStateService,
    RealtimeInitializerService,
    RealtimeSocketService,
  ],
  exports: [RealtimeSocketService],
})
export class RealtimeModule {}
