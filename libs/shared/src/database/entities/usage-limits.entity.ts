import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('usage_limits')
export class UsageLimits {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'servers_limit', type: 'int', default: 0 })
  serversLimit: number;

  @Column({ name: 'members_limit', type: 'int', default: 0 })
  membersLimit: number;

  @Column({ name: 'messages_limit', type: 'int', default: 0 })
  messagesLimit: number;

  @Column({ name: 'servers_used', type: 'int', default: 0 })
  serversUsed: number;

  @Column({ name: 'members_used', type: 'int', default: 0 })
  membersUsed: number;

  @Column({ name: 'messages_used', type: 'int', default: 0 })
  messagesUsed: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
