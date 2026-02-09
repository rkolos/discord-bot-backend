import {
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PublicModule } from './public/public.module';
import { MeModule } from './me/me.module';
import { CompaniesModule } from './companies/companies.module';
import { GuildsModule } from './guilds/guilds.module';
import { WidgetsModule } from './widgets/widgets.module';
import { CountersModule } from './counters/counters.module';
import { LogsModule } from './logs/logs.module';
import { WelcomeGoodbyeModule } from './welcome-goodbye/welcome-goodbye.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UserDataModule } from './user-data/user-data.module';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TestValidationController } from './test-validation.controller';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    AuthModule,
    PublicModule,
    MeModule,
    CompaniesModule,
    GuildsModule,
    WidgetsModule,
    CountersModule,
    LogsModule,
    WelcomeGoodbyeModule,
    AnalyticsModule,
    UserDataModule,
    HealthModule,
    RealtimeModule,
  ],
  controllers: [TestValidationController],
})
export class AppModule {}
