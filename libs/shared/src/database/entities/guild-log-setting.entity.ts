import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Guild } from './guild.entity';

@Entity('guild_log_settings')
export class GuildLogSetting {
  @PrimaryColumn({ name: 'guild_id', type: 'uuid' })
  guildId: string;

  @PrimaryColumn({ name: 'event_type', type: 'text' })
  eventType: string;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild: Guild;

  @Column({ name: 'channel_id', type: 'text', nullable: true })
  channelId: string | null;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
