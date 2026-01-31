import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { WidgetsService } from './widgets.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { PatchWidgetDto } from './dto/patch-widget.dto';
import { WidgetIdParamDto } from './dto/widget-id-param.dto';

@ApiTags('Widgets')
@ApiBearerAuth()
@Controller('guilds/:guildId/widgets')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  @ApiOperation({
    summary: 'List widgets',
    description:
      'Returns all widgets for the guild (id, name, config, embedUrl, embedCode). Bearer JWT, guild admin.',
  })
  async getWidgets(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: Array<{
      id: string;
      guildId: string;
      name: string;
      config: Record<string, unknown>;
      embedUrl: string;
      embedCode: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }> {
    const data = await this.widgetsService.getWidgetsByGuild(params.guildId);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create widget',
    description:
      'Creates a new embeddable widget. Body: name, config. Returns created widget with embedUrl and embedCode. Bearer JWT, guild admin.',
  })
  async createWidget(
    @Param() params: GuildIdParamDto,
    @Body() dto: CreateWidgetDto,
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
    const data = await this.widgetsService.createWidget(
      params.guildId,
      dto.name,
      dto.config ?? {},
    );
    return { data };
  }

  @Patch(':widgetId')
  @ApiOperation({
    summary: 'Update widget',
    description:
      'Updates widget name or config. Body: name, config. Returns updated widget. Bearer JWT, guild admin.',
  })
  async updateWidget(
    @Param() params: GuildIdParamDto & WidgetIdParamDto,
    @Body() dto: PatchWidgetDto,
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
    const data = await this.widgetsService.updateWidget(
      params.guildId,
      params.widgetId,
      dto.name,
      dto.config,
    );
    return { data };
  }

  @Delete(':widgetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete widget',
    description:
      'Removes a widget. Bearer JWT, guild admin.',
  })
  async deleteWidget(
    @Param() params: GuildIdParamDto & WidgetIdParamDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.widgetsService.deleteWidget(
      params.guildId,
      params.widgetId,
    );
    return { data };
  }
}
