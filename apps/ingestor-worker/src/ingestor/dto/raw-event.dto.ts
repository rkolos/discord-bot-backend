import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Snowflake } from '@app/shared';
import { INGESTOR_EVENT_TYPES, PLAN_TIERS } from '../constants';
import type { IngestorEventType, PlanTier } from '../constants';

export class RawEventDto {
  @IsUUID('4')
  eventId: string;

  @IsIn([...INGESTOR_EVENT_TYPES])
  eventType: IngestorEventType;

  @IsISO8601({ strict: true })
  eventTime: string;

  @IsUUID('4')
  guildId: string;

  @Snowflake()
  discordGuildId: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string | null;

  @IsOptional()
  @Snowflake()
  discordUserId?: string | null;

  @IsOptional()
  @Snowflake()
  channelId?: string | null;

  @IsOptional()
  @IsIn([...PLAN_TIERS])
  planTier?: PlanTier | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  roleId?: string | null;

  @IsOptional()
  @IsString()
  commandName?: string | null;

  @IsOptional()
  isBotGenerated?: boolean;
}
