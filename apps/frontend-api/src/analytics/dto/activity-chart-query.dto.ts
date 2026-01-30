import { IsDateString, IsOptional, IsIn } from 'class-validator';
import { IsTimezone } from '@app/shared';

export class ActivityChartQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsTimezone()
  timezone?: string;
}
