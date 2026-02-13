import { ANALYTICS_EVENT_TYPES_FOR_UI, MAX_DATA_RETENTION_DAYS } from '@app/shared';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PatchSettingsDto {
  @IsOptional()
  @IsString()
  serverName?: string;

  @IsOptional()
  @IsString()
  serverDescription?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  botToken?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_DATA_RETENTION_DAYS)
  dataRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  anonymizeUserData?: boolean;

  @IsOptional()
  @IsBoolean()
  shareAnalytics?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPublicWidgets?: boolean;

  /** Типы событий Discord, которые не писать в ClickHouse. Пустой массив или null = по умолчанию только PRESENCE_UPDATE. */
  @IsOptional()
  @IsArray()
  @IsIn([...ANALYTICS_EVENT_TYPES_FOR_UI], { each: true })
  @Type(() => String)
  analyticsEventTypesBlacklist?: string[] | null;
}
