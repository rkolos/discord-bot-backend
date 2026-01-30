import { Controller, Get, Param } from '@nestjs/common';
import { WidgetsService } from './widgets.service';
import { WidgetIdParamDto } from './dto/widget-id-param.dto';

@Controller('widgets')
export class WidgetsPublicController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get(':widgetId')
  async getWidgetById(
    @Param() params: WidgetIdParamDto,
  ): Promise<{
    data: {
      id: string;
      guildId: string;
      name: string;
      config: Record<string, unknown>;
      embedUrl: string;
      embedCode: string;
      createdAt: string;
      updatedAt: string;
    };
  }> {
    const data = await this.widgetsService.getWidgetById(params.widgetId);
    return { data };
  }
}
