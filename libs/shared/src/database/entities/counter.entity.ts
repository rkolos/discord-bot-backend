import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Guild } from './guild.entity';

export enum CounterType {
  STAT = 'stat',
  GOAL = 'goal',
  CLOCK = 'clock',
}

export enum CounterMetric {
  MEMBERS = 'members',
  MESSAGES = 'messages',
  VOICE = 'voice',
  ONLINE = 'online',
}

export enum CounterStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

@Entity('counters')
export class Counter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'guild_id', type: 'uuid' })
  guildId: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild: Guild;

  @Column({ name: 'channel_id', type: 'text' })
  channelId: string;

  @Column({ name: 'channel_name', type: 'text' })
  channelName: string;

  @Column({
    name: 'type',
    type: 'text',
    enum: CounterType,
  })
  type: CounterType;

  @Column({
    name: 'metric',
    type: 'text',
    enum: CounterMetric,
    nullable: true,
  })
  metric: CounterMetric | null;

  @Column({ name: 'template', type: 'text' })
  template: string;

  @Column({
    name: 'status',
    type: 'text',
    enum: CounterStatus,
  })
  status: CounterStatus;

  @Column({ name: 'current_value', type: 'bigint', nullable: true })
  currentValue: string | null;

  @Column({ name: 'target', type: 'bigint', nullable: true })
  target: string | null;

  @Column({ name: 'timezone', type: 'text', nullable: true })
  timezone: string | null;

  @Column({ name: 'date_format', type: 'text', nullable: true })
  dateFormat: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
