import { IsObject, IsString, IsOptional } from 'class-validator';
import { WidgetConfigDto } from './create-widget.dto';

export class PatchWidgetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: WidgetConfigDto;
}
