import { IsUUID } from 'class-validator';

export class WidgetIdParamDto {
  @IsUUID()
  widgetId: string;
}
