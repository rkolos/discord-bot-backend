import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum GuildStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export enum GuildSubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum HistorySyncStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('guilds')
export class Guild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'discord_guild_id', type: 'text', unique: true })
  discordGuildId: string;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl: string | null;

  @Column({ name: 'banner', type: 'text', nullable: true })
  banner: string | null;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({
    name: 'status',
    type: 'text',
    enum: GuildStatus,
  })
  status: GuildStatus;

  @Column({
    name: 'subscription_tier',
    type: 'text',
    enum: GuildSubscriptionTier,
  })
  subscriptionTier: GuildSubscriptionTier;

  @Column({ name: 'member_count', type: 'int', default: 0 })
  memberCount: number;

  @Column({ name: 'message_count', type: 'bigint', default: 0 })
  messageCount: string;

  @Column({ name: 'online_members', type: 'int', nullable: true })
  onlineMembers: number | null;

  @Column({ name: 'member_growth', type: 'int', nullable: true })
  memberGrowth: number | null;

  @Column({ name: 'last_activity', type: 'timestamptz', nullable: true })
  lastActivity: Date | null;

  @Column({ name: 'shard_id', type: 'int', nullable: true })
  shardId: number | null;

  @Column({ name: 'is_bot_in_guild', type: 'boolean', default: false })
  isBotInGuild: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({
    name: 'history_sync_status',
    type: 'text',
    enum: HistorySyncStatus,
    default: HistorySyncStatus.PENDING,
  })
  historySyncStatus: HistorySyncStatus;
}
