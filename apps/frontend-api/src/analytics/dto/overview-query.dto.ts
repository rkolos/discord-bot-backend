import { IsOptional } from 'class-validator';
import { IsTimezone } from '@app/shared';

export class OverviewQueryDto {
  @IsOptional()
  @IsTimezone()
  timezone?: string;
}
