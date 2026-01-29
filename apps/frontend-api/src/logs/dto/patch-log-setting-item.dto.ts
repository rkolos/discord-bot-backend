import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Snowflake } from '@app/shared';
import { LOG_EVENT_TYPES } from '../constants';
import type { LogEventType } from '../constants';

export class PatchLogSettingItemDto {
  @IsIn([...LOG_EVENT_TYPES], {
    message: 'eventType must be one of: member_join, member_leave, message_delete, message_edit, role_update, voice_change',
  })
  eventType: LogEventType;

  @IsOptional()
  @Snowflake()
  channelId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
