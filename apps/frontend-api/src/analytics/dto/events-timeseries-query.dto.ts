import { IsIn, IsOptional, IsArray, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsTimezone } from '@app/shared';

export class EventsTimeseriesQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  eventTypes?: string[];

  @IsOptional()
  @IsTimezone()
  timezone?: string;
}
