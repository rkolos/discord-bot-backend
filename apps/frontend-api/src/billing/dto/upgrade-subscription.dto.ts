import { IsEnum, IsIn } from 'class-validator';
import { UserPlan } from '@app/shared';

export class UpgradeSubscriptionDto {
  @IsEnum(UserPlan)
  planId: UserPlan;

  @IsIn(['month', 'year'])
  pricePeriod: 'month' | 'year';
}
