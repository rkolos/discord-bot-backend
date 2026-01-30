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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { WidgetsService } from './widgets.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { PatchWidgetDto } from './dto/patch-widget.dto';
import { WidgetIdParamDto } from './dto/widget-id-param.dto';

@Controller('guilds/:guildId/widgets')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
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
