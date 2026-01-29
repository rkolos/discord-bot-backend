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
  CounterType,
  COUNTER_TEMPLATE_MAX_LENGTH,
  IsCounterTemplate,
  Snowflake,
} from '@app/shared';

export class CreateCounterDto {
  @Snowflake()
  channelId: string;

  @IsEnum(CounterType)
  type: CounterType;

  @IsOptional()
  @IsEnum(CounterMetric)
  metric?: CounterMetric | null;

  @IsString()
  @MaxLength(COUNTER_TEMPLATE_MAX_LENGTH)
  @IsCounterTemplate()
  template: string;

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
