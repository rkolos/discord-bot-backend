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
import { UserDataModule } from './user-data/user-data.module';
import { HealthModule } from './health/health.module';
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
    UserDataModule,
    HealthModule,
  ],
  controllers: [TestValidationController],
})
export class AppModule {}
