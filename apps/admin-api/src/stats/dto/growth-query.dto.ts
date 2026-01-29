import { IsOptional, IsDateString } from 'class-validator';

export class GrowthQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
