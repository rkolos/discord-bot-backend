import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { RegisterCommandsDto } from './dto/register-commands.dto';
import { BotsService } from './bots.service';

@ApiTags('Bots')
@ApiBearerAuth()
@Controller('api/bots')
@UseGuards(AdminAuthGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post('commands/register')
  @ApiOperation({
    summary: 'Register bot commands',
    description: 'Registers slash commands globally or for a guild. Body: scope, guildId (if scope=guild). Admin JWT.',
  })
  async registerCommands(@Body() dto: RegisterCommandsDto): Promise<{ ok: boolean }> {
    if (dto.scope === 'guild' && !dto.guildId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'guildId is required when scope is guild',
      });
    }
    await this.botsService.registerCommands(dto);
    return { ok: true };
  }
}
