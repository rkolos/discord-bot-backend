import { IsOptional, IsString, MaxLength } from 'class-validator';
import { COUNTER_TEMPLATE_MAX_LENGTH, IsCounterTemplate } from '@app/shared';

export class PreviewCounterDto {
  @IsString()
  @MaxLength(COUNTER_TEMPLATE_MAX_LENGTH)
  @IsCounterTemplate()
  template: string;

  @IsOptional()
  @IsString()
  type?: string;
}
