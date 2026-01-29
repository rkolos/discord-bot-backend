import {
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { GuildsModule } from './guilds/guilds.module';
import { CountersModule } from './counters/counters.module';
import { LogsModule } from './logs/logs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TestValidationController } from './test-validation.controller';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    AuthModule,
    GuildsModule,
    CountersModule,
    LogsModule,
    AnalyticsModule,
  ],
  controllers: [TestValidationController],
})
export class AppModule {}
