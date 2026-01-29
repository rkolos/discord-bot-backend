import { Entity, PrimaryColumn, Column } from 'typeorm';

export type SubscriptionPlanId = 'free' | 'pro' | 'enterprise';

export enum PricePeriod {
  MONTH = 'month',
  YEAR = 'year',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryColumn({ name: 'id', type: 'text' })
  id: SubscriptionPlanId;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({
    name: 'price_period',
    type: 'text',
    enum: PricePeriod,
  })
  pricePeriod: PricePeriod;
}
