import { IsDateString, IsOptional, IsIn } from 'class-validator';

export class ActivityChartQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month';
}
