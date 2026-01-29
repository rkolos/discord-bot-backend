import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CounterMetric,
  CounterStatus,
  CounterType,
  COUNTER_TEMPLATE_MAX_LENGTH,
  IsCounterTemplate,
  Snowflake,
} from '@app/shared';

export class PatchCounterDto {
  @IsOptional()
  @Snowflake()
  channelId?: string;

  @IsOptional()
  @IsEnum(CounterType)
  type?: CounterType;

  @IsOptional()
  @IsEnum(CounterMetric)
  metric?: CounterMetric | null;

  @IsOptional()
  @IsString()
  @MaxLength(COUNTER_TEMPLATE_MAX_LENGTH)
  @IsCounterTemplate()
  template?: string;

  @IsOptional()
  @IsEnum(CounterStatus)
  status?: CounterStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  target?: number;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  dateFormat?: string | null;
}
