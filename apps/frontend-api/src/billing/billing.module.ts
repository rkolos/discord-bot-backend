import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  User,
  SubscriptionPlan,
  UsageLimits,
  PlanLimits,
  Invoice,
} from '@app/shared';
import { BillingService } from './billing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      SubscriptionPlan,
      UsageLimits,
      PlanLimits,
      Invoice,
    ]),
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
