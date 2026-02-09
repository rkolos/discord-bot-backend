import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Guild } from './guild.entity';

@Entity('server_settings')
export class ServerSettings {
  @PrimaryColumn({ name: 'guild_id', type: 'uuid' })
  guildId: string;

  @OneToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild: Guild;

  @Column({ name: 'server_name', type: 'text' })
  serverName: string;

  @Column({ name: 'server_description', type: 'text', nullable: true })
  serverDescription: string | null;

  @Column({ name: 'language', type: 'text' })
  language: string;

  @Column({ name: 'timezone', type: 'text', default: 'UTC' })
  timezone: string;

  @Column({ name: 'bot_token_encrypted', type: 'text', nullable: true })
  botTokenEncrypted: string | null;

  @Column({ name: 'bot_connected', type: 'boolean', default: false })
  botConnected: boolean;

  @Column({ name: 'bot_user_id', type: 'text', nullable: true })
  botUserId: string | null;

  @Column({ name: 'last_connected', type: 'timestamptz', nullable: true })
  lastConnected: Date | null;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  @Column({ name: 'data_retention_days', type: 'int', default: 0 })
  dataRetentionDays: number;

  @Column({ name: 'anonymize_user_data', type: 'boolean', default: false })
  anonymizeUserData: boolean;

  @Column({ name: 'share_analytics', type: 'boolean', default: true })
  shareAnalytics: boolean;

  @Column({ name: 'allow_public_widgets', type: 'boolean', default: true })
  allowPublicWidgets: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
