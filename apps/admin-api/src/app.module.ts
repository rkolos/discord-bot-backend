import {
  ClickHouseModule,
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TestValidationController } from './test-validation.controller';
import { AuthModule } from './auth/auth.module';
import { AdminAuthGuard } from './auth/admin-auth.guard';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    ClickHouseModule.forRootAsync(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    StatsModule,
  ],
  controllers: [TestValidationController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AdminAuthGuard },
  ],
})
export class AppModule {}
