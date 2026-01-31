import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WidgetsService } from './widgets.service';
import { WidgetIdParamDto } from './dto/widget-id-param.dto';

@ApiTags('Widgets (Public)')
@Controller('widgets')
export class WidgetsPublicController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get(':widgetId')
  @ApiOperation({
    summary: 'Get widget by ID (public)',
    description:
      'Returns widget by ID for embedding. No auth required.',
  })
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
