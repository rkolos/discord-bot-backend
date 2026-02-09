import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Guild } from './guild.entity';

export type WelcomeGoodbyeType = 'welcome' | 'goodbye';
export type WelcomeGoodbyeMessageType = 'text' | 'embed' | 'text_and_embed';

export interface WelcomeGoodbyeEmbedFields {
  name: string;
  value: string;
}

export interface WelcomeGoodbyeContentEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: WelcomeGoodbyeEmbedFields[];
}

@Entity('guild_welcome_goodbye_settings')
export class GuildWelcomeGoodbyeSetting {
  @PrimaryColumn({ name: 'guild_id', type: 'uuid' })
  guildId: string;

  @PrimaryColumn({ name: 'type', type: 'text' })
  type: WelcomeGoodbyeType;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild: Guild;

  @Column({ name: 'channel_id', type: 'text', nullable: true })
  channelId: string | null;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'message_type', type: 'text', default: 'text' })
  messageType: WelcomeGoodbyeMessageType;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText: string | null;

  @Column({ name: 'content_embed', type: 'jsonb', nullable: true })
  contentEmbed: WelcomeGoodbyeContentEmbed | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
