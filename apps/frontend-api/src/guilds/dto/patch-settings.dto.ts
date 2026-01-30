import { MAX_DATA_RETENTION_DAYS } from '@app/shared';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

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
}
