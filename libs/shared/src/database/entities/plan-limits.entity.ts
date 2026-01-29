import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('plan_limits')
export class PlanLimits {
  @PrimaryColumn({ name: 'plan_id', type: 'text' })
  planId: string;

  @OneToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'servers_limit', type: 'int' })
  serversLimit: number;

  @Column({ name: 'members_limit', type: 'int' })
  membersLimit: number;

  @Column({ name: 'messages_limit', type: 'int' })
  messagesLimit: number;
}
