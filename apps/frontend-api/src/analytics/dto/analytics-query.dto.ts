import { IsDateString, IsOptional } from 'class-validator';
import { IsTimezone } from '@app/shared';

export class AnalyticsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsTimezone()
  timezone?: string;
}
